import { tracePropAccess } from './index'

describe('proxy', () => {
    it('get value', () => {
        const obj = {
            'hello': 'world'
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect(proxiedObj.hello).toBe('world');
        expect(mockFn).toBeCalledWith([[{key: 'hello', type: 'string'}]], 'world');
    });

    it('nested value', () => {
        const obj = {
            nested: {
                value: 'hello'
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect(proxiedObj.nested.value).toBe('hello');
        expect(mockFn).toBeCalledWith([[{key: 'nested', type: 'object'}, {key: 'value', type: 'string'}]], 'hello');
    });


    it('function', () => {
        const obj = {
            nested: {
                fn: () => 'world'
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect(proxiedObj.nested.fn('da')).toBe('world');
    });

    it('function returns object', () => {
        const obj = {
            nested: {
                fn: () => ({
                    'hello': 'world'
                })
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect(proxiedObj.nested.fn('someArg').hello).toBe('world');
        expect(mockFn).toBeCalledWith([[{key: 'nested', type: 'object'}, {key: 'fn', type: 'function', callArgs: ['someArg'] }], [{key: 'hello', type: 'string'}]], 'world');
    });

    it('async function returns literal', async () => {
        const obj = {
            nested: {
                fn: async () => {
                    return 5;
                }
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect(await proxiedObj.nested.fn('someArg')).toBe(5);
        expect(mockFn).toBeCalledWith([[{key: 'nested', type: 'object'}, {key: 'fn', type: 'function', callArgs: ['someArg'] }]], 5);
    });

    it('async function returns object', async () => {
        const obj = {
            nested: {
                fn: async () => {
                    return {
                        'hello': 'world'
                    };
                }
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect((await proxiedObj.nested.fn('someArg')).hello).toBe('world');
        expect(mockFn).toBeCalledWith([[{key: 'nested', type: 'object'}, {key: 'fn', type: 'function', callArgs: ['someArg'] }], [{key: 'hello', type: 'string'}]], 'world');
    });

    it('should not follow if predicate returns false', async () => {
        const returnObj = {
            'hello': 'world'
        };
        const obj = {
            nested: {
                _fn: async () => {
                    return returnObj
                }
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn, shouldFollow: (target: any, propKey: any) => !propKey.toString().startsWith('_') });

        expect((await proxiedObj.nested._fn('someArg')).hello).toBe('world');
        expect(mockFn).not.toBeCalled();
    });

    it('should not follow non existant', async () => {
        const obj = {};

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect(proxiedObj.hello).toBe(undefined);
        expect(mockFn).not.toBeCalled();
    });

    it('should work with async function returns object', async () => {
        const firstReturnObject = {
            'hello': 'world'
        };

        const secondReturnObject = {
            'hello': 'this is dog'
        };
        const obj = {
            nested: {
                fn1: async () => firstReturnObject,
                fn2: async () => secondReturnObject
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        expect((await proxiedObj.nested.fn1('someArg')).hello).toBe('world');
        expect((await proxiedObj.nested.fn2()).hello).toBe('this is dog');

        expect(mockFn).nthCalledWith(1, [
            [{key: 'nested', type: 'object'}, {key: 'fn1', type: 'function', callArgs: ['someArg'] }]
        ], firstReturnObject);

        expect(mockFn).nthCalledWith(2, [
            [{key: 'nested', type: 'object'}, {key: 'fn1', type: 'function', callArgs: ['someArg'] }],
            [{key: 'hello', type: 'string'}]
        ], 'world');

        expect(mockFn).nthCalledWith(3, [
            [{key: 'nested', type: 'object'}, {key: 'fn2', type: 'function', callArgs: [] }]
        ], secondReturnObject);

        expect(mockFn).nthCalledWith(4, [
            [{key: 'nested', type: 'object'}, {key: 'fn2', type: 'function', callArgs: [] }],
            [{key: 'hello', type: 'string'}]
        ], 'this is dog');
    });

    it('should consider typed arrays and buffers as literals', async () => {
        const obj = {
            nested: {
                fn: async () => {
                    return new Uint16Array([0x30]);
                }
            }
        };


        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        const result = (await proxiedObj.nested.fn('someArg'));
        expect(mockFn).toBeCalledWith([[{key: 'nested', type: 'object'}, {key: 'fn', type: 'function', callArgs: ['someArg'] }]], new Uint16Array([0x30]));
        expect(typeof result).toBe('object');
        expect(result).toBeInstanceOf(Uint16Array)
    });

    it('should consider typed arrays and buffers as literals', async () => {
        const obj = {
            nested: {
                fn: async () => ({
                    hello: new Uint16Array([0x30])
                })
            }
        };


        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        const result = (await proxiedObj.nested.fn('someArg')).hello;
        expect(mockFn).toBeCalledWith([[{key: 'nested', type: 'object'}, {key: 'fn', type: 'function', callArgs: ['someArg'] }], [{key: 'hello', type: 'object'}]], new Uint16Array([0x30]));
        expect(typeof result).toBe('object');
        expect(result).toBeInstanceOf(Uint16Array)
    });


    it('should handle promises', async () => {
        const obj = {
            goto: function() {
                return new Promise((resolve) => setTimeout(() => resolve('hello'), 1))
            }
        };


        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        const result = (await proxiedObj.goto('http://yury.com'));
        expect(mockFn).toBeCalledWith([[{key: 'goto', type: 'function', callArgs: ['http://yury.com'] }]], 'hello');
        expect(result).toBe('hello');
    });

    it('should handle promises that return complex object', async () => {
        const obj = {
            goto: function() {
                return new Promise((resolve) => setTimeout(() => resolve({
                    name: 'yury',
                    fn: () => 'hello',
                }), 1))
            }
        };


        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        const result = (await proxiedObj.goto('http://yury.com'));
        const name = result.name;
        const fnResult = result.fn();

        expect(mockFn).toBeCalledWith([[{"key":"goto","type":"function","callArgs":["http://yury.com"]}],[{"key":"name","type":"string"}]], "yury");
        expect(mockFn).toBeCalledWith([[{"key":"goto","type":"function","callArgs":["http://yury.com"]}],[{"key":"fn","type":"function","callArgs":[]}]], "hello");
        expect(name).toBe('yury');
        expect(fnResult).toBe('hello');
    });


    it('should handle a function that retuns a promise with result object without subsequent calls on the objects', async () => {
        const resultObject = {
            name: 'yury',
            fn: () => 'hello',
        };
        const obj = {
            goto: function() {
                return new Promise((resolve) => setTimeout(() => resolve(resultObject), 1))
            }
        };


        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        await (proxiedObj.goto('http://yury.com'));

        expect(mockFn).toBeCalledWith([[{"key":"goto","type":"function","callArgs":["http://yury.com"]}]], resultObject);
    });


    it('should handle a function that retuns a rejected promise with result object without subsequent calls on the objects', async () => {
        const errorObject = new Error('Bad error!');
        const obj = {
            goto: function() {
                return new Promise((reject) => setTimeout(() => reject(errorObject), 1))
            }
        };


        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        try {
            await (proxiedObj.goto('http://yury.com'));
        } catch {
        }

        expect(mockFn).toBeCalledWith([[{"key":"goto","type":"function","callArgs":["http://yury.com"]}]], errorObject);
    });

    it('should handle a function that retuns a rejected promise with result object without subsequent calls on the objects', async () => {
        const errorObject = new Error('Bad error!');
        const obj = {
            goto: async function() {
                throw errorObject;
            }
        };

        const mockFn = jest.fn();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn });

        try {
            await (proxiedObj.goto('http://yury.com'));
        } catch {
        }

        expect(mockFn).toBeCalledWith([[{"key":"goto","type":"function","callArgs":["http://yury.com"]}]], errorObject);
    });

    it('should trap async function call when instructed', async () => {
        const resultObject = {
            name: 'yury',
            fn: async () => 'hello',
        };
        const obj = {
            eval: function() {
                return new Promise((resolve) => setTimeout(() => resolve(resultObject), 1))
            }
        };


        const mockFn = jest.fn();

        const createMaybeCreateAsyncTrap = () => {
            let resolveTrap: Function = () => void 0;
            const promise = new Promise((resolve) => {
                resolveTrap = resolve;
            });

            const maybeCreateAsyncTrap = jest.fn(async () => {
                await promise;
            });

            return {
                resolveTrap,
                maybeCreateAsyncTrap,
                promise,
            }
        }
        const { resolveTrap, maybeCreateAsyncTrap } = createMaybeCreateAsyncTrap();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn, maybeCreateAsyncTrap });


        const resultPromise = proxiedObj.eval('#someid');

        // Wait for promises to flush
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(maybeCreateAsyncTrap).toBeCalled();
        expect(mockFn).not.toBeCalled();

        resolveTrap();

        await resultPromise;

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toBeCalledWith([[{"key":"eval","type":"function","callArgs":["#someid"]}]], resultObject);
    });

    it('should trap async function call when instructed even if the function rejects', async () => {
        const resultObject = {
            name: 'yury',
            fn: async () => 'hello',
        };
        const obj = {
            eval: function() {
                return new Promise((resolve) => setTimeout(() => resolve(resultObject), 1))
            }
        };


        const mockFn = jest.fn();

        const createMaybeCreateAsyncTrap = () => {
            let rejectTrap: Function = () => void 0;
            const promise = new Promise((resolve, reject) => {
                rejectTrap = reject;
            });

            const maybeCreateAsyncTrap = jest.fn(async () => {
                await promise;
            });

            return {
                rejectTrap,
                maybeCreateAsyncTrap,
                promise,
            }
        }
        const { rejectTrap, maybeCreateAsyncTrap } = createMaybeCreateAsyncTrap();
        const proxiedObj = tracePropAccess(obj, { callback: mockFn, maybeCreateAsyncTrap });


        const resultPromise = proxiedObj.eval('#someid');

        // Wait for promises to flush
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(maybeCreateAsyncTrap).toBeCalled();
        expect(mockFn).not.toBeCalled();

        rejectTrap();

        await resultPromise;

        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toBeCalledWith([[{"key":"eval","type":"function","callArgs":["#someid"]}]], resultObject);
    });
});
