const endpointHelper = require('../endpointHelper.js');

describe('endpointHelper.js tests', () => {
  test("error code constructor works", () => {
    const err_message = "test error message";
    const err_status = 418;
    const statusErr = new endpointHelper.StatusCodeError(err_message, err_status);
    expect(statusErr.message).toBe(err_message);
    expect(statusErr.statusCode).toBe(err_status);
  });

  test('asyncHandler doesnt propagate accepted promise to next', async () => {
    const fn = async () => Promise.resolve(1);
    const wrapped = endpointHelper.asyncHandler(fn);
    const next = jest.fn();
    await wrapped({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('asyncHandler propagates rejected promise to next', async () => {
    const err = new Error('fail async');
    const fn = async () => Promise.reject(err);
    const wrapped = endpointHelper.asyncHandler(fn);
    const next = jest.fn();
    await wrapped({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
