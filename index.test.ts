import test from "node:test";
import assert from "node:assert";

import {
  transient,
  singleton,
  factory,
  createContainer,
  withContainer,
  getCaller,
  MutableContainer,
  ReadonlyContainer,
  All,
  None,
} from "./";

const rand = (() => {
  let i = 0;
  return () => i++;
})();

test("transient vs singleton", () => {
  const traDep = transient(rand);
  const sinDep = singleton(rand);

  withContainer(() => {
    assert.notStrictEqual(traDep(), traDep());
    assert.strictEqual(sinDep(), sinDep());
  });
});

test("singletons in different containers", () => {
  const sinDep = singleton(rand);

  const x1 = withContainer(sinDep);
  const x2 = withContainer(sinDep);

  assert.notStrictEqual(x1, x2);
});

test("singletons in same containers", () => {
  const sinDep = singleton(rand);
  const c1 = createContainer();
  const c2 = createContainer();

  const c1x1 = withContainer(sinDep, c1);
  const c2x1 = withContainer(sinDep, c2);
  const c1x2 = withContainer(sinDep, c1);
  const c2x2 = withContainer(sinDep, c2);

  assert.strictEqual(c1x1, c1x2);
  assert.strictEqual(c2x1, c2x2);

  assert.notStrictEqual(c1x1, c2x1);
});

test("bind", () => {
  const traDep = transient(rand);
  const sinDep = singleton(rand);
  const c = createContainer();

  const [t1, s1] = withContainer((bind) => {
    bind(traDep, singleton(rand)); // transient -> singleton
    bind(sinDep, rand); // singleton -> transient

    return [traDep(), sinDep()];
  }, c);

  const [t2, s2] = withContainer(() => [traDep(), sinDep()], c);

  assert.strictEqual(t1, t2);
  assert.notStrictEqual(s1, s2);
});

test("cloned containers", () => {
  const sinDep = singleton(rand);
  const c1 = createContainer();
  const c2 = createContainer(c1);

  const c1x = withContainer(sinDep, c1);
  assert.strictEqual(c1x, withContainer(sinDep, c2));

  const c2x = withContainer((bind) => {
    bind(sinDep, singleton(rand));

    return sinDep();
  }, c2);
  assert.strictEqual(c1x, withContainer(sinDep, c1));
  assert.notStrictEqual(c1x, c2x);

  const c3 = createContainer(c2);
  assert.strictEqual(c2x, withContainer(sinDep, c3));

  const c3x = withContainer((bind) => {
    bind(sinDep, singleton(rand));

    return sinDep();
  }, c3);
  assert.strictEqual(c2x, withContainer(sinDep, c2));
  assert.notStrictEqual(c2x, c3x);
});

test("factory", () => {
  const dep = singleton(
    factory(
      class Test {
        id: number;
        constructor() {
          this.id = rand();
        }
      }
    )
  );

  withContainer(() => {
    assert.strictEqual(dep().id, dep().id);
  });
});

test("getCaller", () => {
  const d1 = transient(() => dep());
  const d2 = transient(() => dep());

  const dep = transient(() => {
    switch (getCaller()) {
      case d1:
        return 1;
      case d2:
        return 2;
    }
  });

  withContainer(() => {
    assert.strictEqual(d1(), 1);
    assert.strictEqual(d2(), 2);
  });
});

test("allow/deny types", () => {
  function testAllow(c: MutableContainer<string | number>) {
    withContainer((bind) => {
      bind(transient(String), String);
      bind(transient(Number), Number);
      // @ts-expect-error
      bind(transient(Boolean), Boolean); // err, boolean is not allowed
    }, c);
  }

  testAllow(createContainer()); // ok, by default allow any
  testAllow(createContainer<string | number | boolean>()); // ok, container allows more types
  // @ts-expect-error
  testAllow(createContainer<number>()); // err, container allows less types

  function testDeny(c: MutableContainer<All, boolean | Date | number[]>) {
    withContainer((bind) => {
      bind(transient(String), String);
      bind(transient(Number), Number);
      // @ts-expect-error
      bind(transient(Boolean), Boolean);
    }, c);
  }

  testDeny(createContainer()); // ok, container doesn't deny any
  // @ts-expect-error
  testDeny(createContainer<All, boolean | number>()); // err, container requires to deny at least `boolean | number`

  function testAllowAndDeny(c: MutableContainer<string, number | boolean>) {
    withContainer((bind) => {
      bind(transient(String), String);
      // @ts-expect-error
      bind(transient(Number), Number);
      // @ts-expect-error
      bind(transient(Boolean), Boolean);
    }, c);
  }

  testAllowAndDeny(createContainer()); // ok, container allows any
  testAllowAndDeny(createContainer<string | Date, number | boolean>());
  // @ts-expect-error
  testAllowAndDeny(createContainer<number>());
  // @ts-expect-error
  testAllowAndDeny(createContainer<All, number | string>());

  function testReadonly(c: ReadonlyContainer) {
    withContainer((bind) => {
      // @ts-expect-error
      bind(transient(Number), Number);
      // @ts-expect-error
      bind(transient(String), String);
      // @ts-expect-error
      bind(transient(Boolean), Boolean);
    }, c);
  }

  const rc = createContainer() as MutableContainer<None>;
  testReadonly(createContainer());
  testReadonly(rc);
});
