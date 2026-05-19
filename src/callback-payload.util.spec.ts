import {
  normalizeCallbackRow,
  parseJsonFragmentFromCodeValue,
  resolveCallbackObjectsFromPost,
  resolveCallbackObjectsFromQuery,
} from './callback-payload.util';

const PARTNER_CODE_FRAGMENT =
  '268012000007097","sequenceNumber":"4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4","data":{"serviceType":"games_Games_98","contentId":"-1","resultCode":"0","renFlag":"Y","requestNo":"4003562882605151927","result":"Success","OptionalParameter3":"UNSUB3D","sequenceNo":"d9d084e462f84481b073d5e9eee7eedf","callingParty":"26878146285","newContentId":"-1","bearerId":"API","operationId":"GR","requestedPlan":"26801220000007822","appliededPlan":"26801220000007822_R","chargeAmount":"1.0","serviceNode":"UNISOLUTION","msisdn":"26878146285","serviceId":"268012000007097","keyword":"","category":"-1","validityDays":"2"},"transactionId":"rrt-8917434836422684028-d-geu1-64532-703588-1","notificationType":"SUBSCRIBE"}';

describe('callback-payload.util', () => {
  it('parses partner code= JSON fragment', () => {
    const parsed = parseJsonFragmentFromCodeValue(PARTNER_CODE_FRAGMENT);
    expect(parsed?.code).toBe('268012000007097');
    expect(parsed?.sequenceNumber).toBe('4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4');
    expect(parsed?.notificationType).toBe('SUBSCRIBE');
    expect((parsed?.data as Record<string, unknown>)?.requestNo).toBe(
      '4003562882605151927',
    );
  });

  it('unwraps nested data and prefers top-level sequenceNumber', () => {
    const row = normalizeCallbackRow({
      sequenceNumber: 'top-seq',
      notificationType: 'SUBSCRIBE',
      data: {
        requestNo: '4003562882605151927',
        result: 'Success',
        sequenceNumber: 'inner-seq',
        serviceId: '268012000007097',
      },
    });

    expect(row.requestNo).toBe('4003562882605151927');
    expect(row.result).toBe('Success');
    expect(row.sequenceNumber).toBe('top-seq');
    expect(row.notificationType).toBe('SUBSCRIBE');
    expect(row.data).toBeUndefined();
  });

  it('fills missing top-level fields from data', () => {
    const row = normalizeCallbackRow({
      code: '268012000007097',
      sequenceNumber: 'seq-1',
      data: {
        requestNo: '1',
        result: 'Success',
        msisdn: '26878146285',
      },
    });

    expect(row.requestNo).toBe('1');
    expect(row.result).toBe('Success');
    expect(row.msisdn).toBe('26878146285');
    expect(row.code).toBe('268012000007097');
  });

  it('resolves partner single-tag code query', () => {
    const rows = resolveCallbackObjectsFromQuery({
      code: PARTNER_CODE_FRAGMENT,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].requestNo).toBe('4003562882605151927');
    expect(rows[0].notificationType).toBe('SUBSCRIBE');
    expect(rows[0].sequenceNumber).toBe('4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4');
    expect(rows[0].serviceType).toBe('games_Games_98');
    expect(rows[0].transactionId).toBe(
      'rrt-8917434836422684028-d-geu1-64532-703588-1',
    );
  });

  it('resolves POST body and overlays code, transactionId, notificationType from query', () => {
    const rows = resolveCallbackObjectsFromPost(
      {
        sequenceNumber: '4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4',
        data: {
          serviceType: 'games_Games_98',
          requestNo: '4003562882605151927',
          result: 'Success',
          chargeAmount: '1.0',
          msisdn: '26878146285',
          serviceId: '268012000007097',
        },
      },
      {
        code: '268012000007097',
        transactionId: 'rrt-8917434836422684028-d-geu1-64532-703588-1',
        notificationType: 'SUBSCRIBE',
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].requestNo).toBe('4003562882605151927');
    expect(rows[0].code).toBe('268012000007097');
    expect(rows[0].serviceType).toBe('games_Games_98');
    expect(rows[0].transactionId).toBe(
      'rrt-8917434836422684028-d-geu1-64532-703588-1',
    );
    expect(rows[0].notificationType).toBe('SUBSCRIBE');
    expect(rows[0].sequenceNumber).toBe('4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4');
  });

  it('query params override POST body for code, transactionId, notificationType', () => {
    const rows = resolveCallbackObjectsFromPost(
      {
        code: 'body-code',
        transactionId: 'body-tx',
        notificationType: 'UNSUBSCRIBE',
        data: { requestNo: '1', result: 'Success' },
      },
      {
        code: 'query-code',
        transactionId: 'query-tx',
        notificationType: 'SUBSCRIBE',
      },
    );

    expect(rows[0].code).toBe('query-code');
    expect(rows[0].transactionId).toBe('query-tx');
    expect(rows[0].notificationType).toBe('SUBSCRIBE');
  });

  it('merges flat query params with JSON data param', () => {
    const rows = resolveCallbackObjectsFromQuery({
      code: '268012000007097',
      notificationType: 'SUBSCRIBE',
      data: JSON.stringify({
        requestNo: '99',
        result: 'Success',
        chargeAmount: '1.0',
      }),
    });

    expect(rows[0].requestNo).toBe('99');
    expect(rows[0].notificationType).toBe('SUBSCRIBE');
    expect(rows[0].code).toBe('268012000007097');
  });
});
