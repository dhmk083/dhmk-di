let globalContainerContext: MutableContainer | undefined;

const DEPENDENCY_TAG = "@dhmk/di/dependency";

export type Dependency<T> = {
  (): T;
  [DEPENDENCY_TAG]: unknown; // defaultFn
};

type DependencyFunction = () => unknown;

declare const allow: unique symbol;
declare const deny: unique symbol;
declare const all: unique symbol;
declare const none: unique symbol;

export type All = typeof all;
export type None = typeof none;

export type ReadonlyContainer = MutableContainer<None>;

export type MutableContainer<Allow = All, Deny = None> = {
  [allow]?: (allow: Allow) => void;
  [deny]?: Deny;

  dependenciesMap: Map<Dependency<unknown>, DependencyFunction>;
  singletonsStateMap: WeakMap<DependencyFunction, { state: unknown }>;
  callersStack: Dependency<unknown>[];
};

type ResolvePermission<T> = T extends All ? any : T;

type ValidateDependency<T, A, D> = T extends ResolvePermission<A>
  ? T extends ResolvePermission<D>
    ? never
    : unknown
  : never;

type Bind<C extends MutableContainer<any, any>> = C extends MutableContainer<
  infer A,
  infer D
>
  ? <T>(
      dependency: Dependency<T & ValidateDependency<T, A, D>>,
      fn: () => T
    ) => T
  : never;

export const createContainer = <Allow = All, Deny = None>(
  cont?: MutableContainer<Allow, Deny>
): MutableContainer<Allow, Deny> => ({
  dependenciesMap: new Map(cont?.dependenciesMap),
  singletonsStateMap: cont?.singletonsStateMap ?? new WeakMap(),
  callersStack: [],
});

function assertContainerContext(
  ctx: MutableContainer | undefined
): asserts ctx {
  if (!ctx)
    throw new Error(
      "This function can run only inside `withContainer` function."
    );
}

function _context() {
  assertContainerContext(globalContainerContext);
  return globalContainerContext;
}

export function dependency<T>(defaultFn: () => T): Dependency<T> {
  const self = () => {
    const { dependenciesMap, callersStack } = _context();

    let depFn = dependenciesMap.get(self);

    if (!depFn) {
      depFn = defaultFn;
      dependenciesMap.set(self, depFn);
    }

    callersStack.push(self);

    try {
      return depFn() as T;
    } finally {
      callersStack.pop();
    }
  };

  self[DEPENDENCY_TAG] = defaultFn;
  return self;
}

export function singletonFunction<T>(fn: () => T): () => T {
  const self = () => {
    const { singletonsStateMap } = _context();

    let stateEntry = singletonsStateMap.get(self);

    if (!stateEntry) {
      stateEntry = { state: fn() }; // to handle `undefined`
      singletonsStateMap.set(self, stateEntry);
    }

    return stateEntry.state as T;
  };

  return self;
}

function _bind<T>(dependency: Dependency<T>, fn: () => T) {
  const { dependenciesMap } = _context();

  // todo if fn === null delete from `dependenciesMap` (clean memory)

  if (DEPENDENCY_TAG in fn) {
    const depFn = dependenciesMap.get(fn);
    fn = (depFn ?? fn[DEPENDENCY_TAG]) as () => T;
  }

  dependenciesMap.set(dependency, fn);
}

export function withContainer<
  T,
  C extends MutableContainer<any, any> = MutableContainer
>(fn: (bind: Bind<C>) => T, context: C = createContainer() as C) {
  const prevContext = globalContainerContext;
  globalContainerContext = context;

  try {
    return fn(_bind as unknown as Bind<C>);
  } finally {
    globalContainerContext = prevContext;
  }
}

export const getCaller = (): Dependency<unknown> | undefined => {
  const { callersStack } = _context();
  return callersStack[callersStack.length - 2];
};

export const transient = dependency;
export const singleton = <T>(fn: () => T) => dependency(singletonFunction(fn));

export const factory =
  <C extends { new () }>(C: C) =>
  (): InstanceType<C> =>
    new C();
