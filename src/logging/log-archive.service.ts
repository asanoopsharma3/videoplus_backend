import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import {
  mkdir,
  readdir,
  rm,
  stat,
  unlink,
} from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestLogService } from './request-log.service';

const MONTH_DIR = /^\d{4}-\d{2}$/;

@Injectable()
export class LogArchiveService implements OnModuleInit {
  private readonly logger = new Logger(LogArchiveService.name);
  private readonly archiveEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly requestLog: RequestLogService,
  ) {
    this.archiveEnabled =
      this.config.get<string>('LOG_ARCHIVE_ENABLED', 'true') !== 'false';
  }

  onModuleInit(): void {
    if (!this.archiveEnabled || !this.requestLog.isEnabled()) return;
    void this.archivePastMonths().catch((e) =>
      this.logger.error(
        `Initial log archive failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  /** Daily: zip completed calendar months, then remove day files for that month. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledArchive(): Promise<void> {
    if (!this.archiveEnabled || !this.requestLog.isEnabled()) return;
    await this.archivePastMonths();
  }

  private currentYearMonth(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  }

  /**
   * For each `{LOG_DIR}/{YYYY-MM}/` strictly before the current month:
   * - If `{LOG_DIR}/archive/{YYYY-MM}.zip` exists, only remove leftover month dir.
   * - Else zip all `*.txt` day log files into the archive file, then delete the month directory.
   */
  async archivePastMonths(): Promise<void> {
    const logRoot = this.requestLog.getLogRoot();
    const archiveDir = join(logRoot, 'archive');
    await mkdir(archiveDir, { recursive: true });

    const currentYm = this.currentYearMonth();
    let names: string[];
    try {
      names = await readdir(logRoot);
    } catch {
      return;
    }

    for (const name of names) {
      if (!MONTH_DIR.test(name)) continue;
      if (name >= currentYm) continue;

      const monthDir = join(logRoot, name);
      const st = await stat(monthDir).catch(() => null);
      if (!st?.isDirectory()) continue;

      const zipPath = join(archiveDir, `${name}.zip`);
      const files = (await readdir(monthDir)).filter((f) => f.endsWith('.txt'));

      try {
        if (files.length > 0) {
          const zipExists = await stat(zipPath).then(
            (s) => s.isFile(),
            () => false,
          );
          if (!zipExists) {
            await this.zipDayLogFiles(monthDir, files, zipPath);
            this.logger.log(`Archived month ${name} -> archive/${name}.zip (${files.length} files)`);
          } else {
            this.logger.warn(
              `Zip already exists for ${name}, removing loose files only`,
            );
          }
        }
        await rm(monthDir, { recursive: true, force: true });
      } catch (e) {
        this.logger.error(
          `Archive failed for ${name}: ${e instanceof Error ? e.message : String(e)}`,
        );
        try {
          await unlink(zipPath);
        } catch {
          /* ignore partial zip cleanup */
        }
      }
    }
  }

  private zipDayLogFiles(
    monthDir: string,
    fileNames: string[],
    zipPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      const onErr = (err: Error) => reject(err);
      archive.on('error', onErr);
      output.on('error', onErr);
      output.on('close', () => resolve());

      archive.pipe(output);
      for (const f of fileNames) {
        archive.file(join(monthDir, f), { name: f });
      }
      void archive.finalize();
    });
  }
}
