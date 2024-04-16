# Small, simple, type-safe DI library.

Easy to use DI library.

- Size < 1KB
- Only 3 core functions to learn
- Minimal boilerplate
- Fully type-safe
- No string keys
- No decorators
- Localized and controlled mutations

**[Demo](#quick-demo)**

**[InversifyJS example](#inversifyjs-example)**

**[API](#api)**

## Install

```sh
npm install @dhmk/di
```

## Quick demo

```ts
import { transient, singleton, withContainer, createContainer } from "@dhmk/di";

// Create dependency from function that doesn't take required arguments

// Transient returns new value on each access
const d1 = transient(Math.random);

// Singleton returns first computed value on each access (per container)
const d2 = singleton(Math.random);

// You can't read dependency value without container context
d1(); // This throws an error

// You can conveniently read dependencies inside function or class arguments.
// (But only if it's called inside container!)
const d3 = singleton((a = d1(), b = d2()) => {
  return a + b;
});

// Run function inside container
withContainer(() => {
  d1(); // Some random number
  d1(); // Different random number

  d2(); // Some random number
  d2(); // Same random number

  return d3(); // You can return any value
});

// Each call to `withContainer` creates a new temporary container.
// So, value of `d2` will be different from above, because singletons are created per container.
withContainer(d2);

// You can create container explicitly, to access its state later
const cont = createContainer();

withContainer(d2, cont) === withContainer(d2, cont);

// You can create container from another container
const cont2 = createContainer(cont);

withContainer(d2, cont) === withContainer(d2, cont2);

// Finally, you can rebind dependencies inside container
withContainer((bind) => {
  bind(d1, () => 123);

  bind(
    d2,
    singleton(() => 123)
  );

  // Just remember to bind dependencies before using them to get a new value.

  // Also, if you bind something inside cloned container (like `cont2`),
  // it will affect only that container and not its parent.
});
```

## InversifyJS example

Here is an adapted example from [InversifyJS](https://inversify.io/).

```ts
import { singleton, factory, withContainer } from "@dhmk/di";

interface Warrior {
  fight(): string;
  sneak(): string;
}

interface Weapon {
  hit(): string;
}

interface ThrowableWeapon {
  throw(): string;
}

// This library is based on functions,
// but you can also use it with classes. (See below)
const getKatana = singleton<Weapon>(() => ({
  hit() {
    return "cut!";
  },
}));

class Shuriken {
  public throw() {
    return "hit!";
  }
}

// or singleton(factory(Shuriken))
// or singleton(factory(class Shuriken {...}))
const getShuriken = singleton<ThrowableWeapon>(() => new Shuriken());

const getNinja = singleton<Warrior>(
  factory(
    class Ninja {
      private _katana: Weapon;
      private _shuriken: ThrowableWeapon;

      // Just call dependencies in constructor or function
      public constructor(katana = getKatana(), shuriken = getShuriken()) {
        this._katana = katana;
        this._shuriken = shuriken;
      }

      public fight() {
        return this._katana.hit();
      }
      public sneak() {
        return this._shuriken.throw();
      }
    }
  )
);

/*

No need to do `container.bind(...).to(...) or similar actions,
because all dependencies are already created bound to default functions.

But if you want, you can create and bind dependencies in a separate file.

Example:

file: katana.ts

export default function createKatana() {...}

file: dependencies.ts

import { singleton } from "@dhmk/di"
import createKatana from "./katana"

export const getKatana = singleton(createKatana)

*/

const ninja = withContainer(getNinja);

console.log(ninja.fight()); // "cut!"
console.log(ninja.sneak()); // "hit!"

// Now, suppose you want to overwrite default dependency.

const ninja2 = withContainer((bind) => {
  bind(getKatana, () => ({ hit: () => "shoot!" }));

  return getNinja();
});

console.log(ninja2.fight()); // "shoot!"
console.log(ninja2.sneak()); // "hit!"
```

## API

### `type Dependency<T> = () => T`

A dependency is just a function that returns a value.

### `transient(fn): Dependency`

Creates transient dependency. `fn` will be called each time dependency is read.

### `singleton(fn): Dependency`

Creates singleton dependency. `fn` will be called once per container and result will be cached.

### `withContainer(fn, container?): ReturnType<fn>`

`fn: (bind) => T`

`bind: (dep, newFn) => void`

Runs `fn` inside `container` (or temporary container) and returns result.

`fn` is called with `bind` function, which can be used to replace a function of a given dependency for this container.

```ts
withContainer((bind) => {
  bind(someDependency, newFunction); // switches `someDependency` to transient
  bind(someDependency, singleton(newFunction)); // switches `someDependency` to singleton
  bind(someDependency, singletonFunction(newFunction)); // same as above
  bind(someDependency, otherDependency); // uses `otherDependency` bound function

  // The code above won't affect `someDependecy` bound functions in other containers.
});
```

### `createContainer(otherContainer?): Container`

Creates container for storing dependencies state. If `otherContainer` is provided, also copies its state.

## Other API

### `dependency(fn): Dependency`

Core dependency creator. `transient` is an alias to this function.

### `factory(Class): Function`

A shortcut to this:

```ts
class SomeClass {}

transient(() => new SomeClass());

// now can write class inline
transient(factory(class SomeClass {}));
```

### `singletonFunction(fn): fn`

Creates singleton function. It will be called once per container.

`singleton` dependency is build around `singletonFunction`:

```ts
const singleton = (fn) => dependency(singletonFunction(fn));
```

### `getCaller(): Dependency | undefined`

Returns a dependency (if any) from which current dependency has been called. Can be used to return different values for different parent dependecies:

```ts
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
```

## Types

### `MutableContainer<Allow = All, Deny = None>`

Only types which extend `Allow` and don't extend `Deny` can be mutated with `bind` inside `withContainer`.

```ts
createContainer() as MutableContainer<string | number, boolean | Date>;
```

### `ReadonlyContainer`

Alias for `MutableContainer<None>`

### `All`

### `None`
