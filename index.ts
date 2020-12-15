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
  shouldFollow?(target: any, propKey: any): boolean;
  maybeCreateAsyncTrap?(target: any, propKey: any, paths: PathPart[][]): Promise<void> | null;
}

const isDataObject = (obj: any) =>
  Buffer.isBuffer(obj) || typeof obj.byteLength === 'number';

export function tracePropAccess(
  obj: any,
  options: TracePropAccessOptions,
  paths: PathPart[][] = [[]],
): any {
  const actualOptions = {
    callback: () => {},
    shouldFollow: () => true,
    ...options,
  };
  return new Proxy(obj, {
    get(target: any, propKey: any) {
      const reflectedProp = Reflect.get(target, propKey);

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
            const trapAsyncMethodPromise = actualOptions.maybeCreateAsyncTrap ? actualOptions.maybeCreateAsyncTrap(target, propKey, newPaths) : null;

            const fnResult = trapAsyncMethodPromise ? trapAsyncMethodPromise.then(() => reflectedProp.apply(target, args), () => reflectedProp.apply(target, args)) : reflectedProp.apply(target, args);
            
            const finishFunctionTracing = (functionResult: any) => {
              newPaths.pop();
              actualOptions.callback(newPaths, functionResult);
            };

            if (typeof fnResult !== 'object' || !fnResult) {
              finishFunctionTracing(fnResult);
              return fnResult;
            }

            if (typeof fnResult.then === 'function') {
              return fnResult.catch((error: Error) => {
                finishFunctionTracing(error);
                return Promise.reject(error);
              }).then((result: any) => {
                if (
                  typeof result === 'object' &&
                  result &&
                  !isDataObject(result)
                ) {
                  return tracePropAccess(result, actualOptions, newPaths);
                }

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
