export enum PathPartType {
  function = 'function',
  object = 'object',
  string = 'string',
  number = 'number',
  boolean = 'boolean',
  symbol = 'symbol',
  undefined = 'undefined',
  bigint = 'bigint',
}

export interface BasePathPart {
  key: string;
  type: Exclude<PathPartType, PathPartType.function>;
}

export interface FunctionPathPart {
  key: string;
  type: PathPartType.function;
  callArgs: any[];
}

export type PathPart = BasePathPart | FunctionPathPart;

export interface TracePropAccessOptions {
  callback?(paths: PathPart[][], result: any): void;
  asyncResultSideEffect?(paths: PathPart[][], error?: Error): Promise<void>;
  shouldFollow?(target: any, propKey: any): boolean;
}

const isDataObject = (obj: any) =>
  Buffer.isBuffer(obj) || typeof obj.byteLength === 'number';

export function tracePropAccess(
  obj: any,
  options: TracePropAccessOptions,
  paths: PathPart[][] = [[]],
  thenOverHeadCount = 0,
): any {
  const actualOptions = {
    callback: () => {},
    shouldFollow: () => true,
    ...options,
  };
  return new Proxy(obj, {
    get(target: any, propKey: any) {
      const reflectedProp = Reflect.get(target, propKey);

      if (propKey === 'then' && thenOverHeadCount > 0) {
        thenOverHeadCount--;
        return reflectedProp;
      }

      if (
        !(propKey in target) /*&& propKey !== 'then'*/ ||
        !actualOptions.shouldFollow(target, propKey)
      ) {
        const pathsSoFar = paths.slice(0, -1);
        if (pathsSoFar.length > 0) {
          actualOptions.callback(pathsSoFar, target);
        }
        return reflectedProp;
      }
      const workingPaths = paths.map(pathArr => [...pathArr]);

      const newPathEntry =
        typeof reflectedProp === 'function'
          ? ({
              key: propKey.toString(),
              type: PathPartType.function,
              callArgs: [],
            } as FunctionPathPart)
          : ({
              key: propKey.toString(),
              type: PathPartType[typeof reflectedProp],
            } as BasePathPart);

      workingPaths[workingPaths.length - 1] = [
        ...workingPaths[workingPaths.length - 1],
        newPathEntry,
      ];
      if (reflectedProp) {
        if (typeof reflectedProp === 'object' && !isDataObject(reflectedProp)) {
          return tracePropAccess(reflectedProp, actualOptions, workingPaths);
        }

        if (typeof reflectedProp === 'function') {
          return function(...args: any) {
            workingPaths[workingPaths.length - 1].pop();
            workingPaths[workingPaths.length - 1].push({
              key: propKey.toString(),
              type: PathPartType.function,
              callArgs: args,
            });
            const newPaths = [...workingPaths, []];
            //@ts-ignore
            const fnResult = reflectedProp.apply(target, args);

            const finishFunctionTracing = (functionResult: any) => {
              newPaths.pop();
              actualOptions.callback(newPaths, functionResult);
            };

            if (typeof fnResult !== 'object' || !fnResult) {
              finishFunctionTracing(fnResult);
              return fnResult;
            }

            if (typeof fnResult.then === 'function') {
              const waitForSideEffect = async (paths: PathPart[][], error?: Error) => {
                if (typeof actualOptions.asyncResultSideEffect === 'function') {
                  await actualOptions.asyncResultSideEffect(paths, error);
                }
              }
              return fnResult.catch(async (error: Error) => {
                await waitForSideEffect(newPaths, error);
                finishFunctionTracing(error);
                return Promise.reject(error);
              }).then(async (result: any) => {
                if (
                  typeof result === 'object' &&
                  result &&
                  !isDataObject(result)
                ) {
                  await waitForSideEffect(newPaths);
                  return tracePropAccess(result, actualOptions, newPaths, 1);
                }

                await waitForSideEffect(newPaths);
                finishFunctionTracing(result);
                return result;
              });
            }

            return tracePropAccess(fnResult, actualOptions, newPaths);
          };
        }
      }

      actualOptions.callback(workingPaths, target[propKey]);
      return reflectedProp;
    },
  });
}
