# Reference (`ref`) declarations and expressions for ECMAScript

This proposal defines new syntax to allow for the declaration and creation of user-defined references to bindings.

# Motivations

* Decorators cannot refer to block-scoped declarations that follow them.
* Simplifies capturing references to bindings in one scope and handing it to another scope.

# Prior Art
* https://github.com/dotnet/roslyn/issues/118

# Proposal

This proposal introduces the following concepts: 

* `ref` expressions (e.g., `ref x`) and `const ref` expressions (e.g., `const ref x`)
* `ref` declarations (e.g., `let ref y = ...`, `const ref y = ...`, `(ref y) => { }`, `(const ref y) => {}`)
* `ref` assignments (e.g., `ref y = r`)
* `Reference` objects
* `const` parameters (as a byproduct of `const ref` parameters)

## `ref` and `const ref` expressions

A `ref` expression is a prefix unary expression that creates a `Reference` object that defines a "live" binding to its operand.

`ref` expressions have the following semantics:
  * The operand must be a valid simple assignment target.
  * When the operand is a property accessor using dot notation, the target of the property accessor is evaluated immediately 
    and a `Reference` object is created for the actual property access.
  * When the operand is a property accessor using bracket notation, the target and the expression of the accessor are evaluated
    immediately and a `Reference` object is created for the actual property access.
  * When the operand is an identifier, a `Reference` object is created for the binding.
  * A `ref` expression is unambiguously a reference to a binding. Host engines can leverage this fact to optimize reference passing.
  * A `const ref` expression is similar to a `ref` expression, except that the value of the resulting `Reference` cannot be set (though changes to the value of the referenced
    binding are still reflected, similar to an `import { x } from ...` binding).

This behavior can be illustrated by the following syntactic conversion:

```js
ref y;
const ref y;
```

is roughly identical in its behavior to:

```js
// ref y;
Object.freeze({ 
  __proto__: Reference.prototype,
  get value() { return y; }, 
  set value(_) { y = _; }
});
// const ref y;
Object.freeze({ 
  __proto__: Reference.prototype,
  get value() { return y; }
});
```

## `ref` and `const ref` declarations

A `ref` declaration is the declaration of a variable or parameter that _dereferences_ a `Reference`, creating a binding 
in the current scope.

`ref` declarations have the following semantics:
  * A `ref` declaration is unambiguously a _dereference_ of some `Reference` object. Host engines can leverage this fact to optimize away 
    the `Reference` object if they can statically determine that the only use-sites are arguments to call expressions whose parameters
    are declared `ref` (i.e., `let ref x = ref y` does not require the allocation of a `Reference` object).
  * A `ref x` parameter introduces a mutable binding to the underlying `Reference`. 
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` assigns to the value of the underlying `Reference`.
    * A `ref x` expression will produce a mutable `Reference` pointing to the same underlying binding as `x`.
    * A `const ref x` expression will produce an immutable `Reference` pointing to the same underlying binding as `x`.
  * A `const ref x` parameter introduces an immutable binding to the underlying `Reference`. 
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` assigns to the value of the underlying `Reference`.
    * Assigning to `x` is an error.
    * A `ref x` is an error as you cannot take a mutable `Reference` to an immutable binding.
    * A `const ref x` expression will produce an immutable `Reference` pointing to the same underlying binding as `x`.
  * A `let ref x` variable declaration introduces a mutable binding to the `Reference` supplied as the initializer.
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` assigns to the value of the underlying `Reference`.
    * A `ref x` expression will produce a mutable `Reference` pointing to the same underlying binding as `x`.
    * A `const ref x` expression will produce an immutable `Reference` pointing to the same underlying binding as `x`.
  * A `const ref x` declaration introduces an immutable binding.
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` is an error.
    * A `ref x` is an error as you cannot take a mutable `Reference` to an immutable binding.
    * A `const ref x` expression will produce an immutable `Reference` pointing to the same underlying binding as `x`.
  * `undefined` and `null` can be used as the value of a `ref` or `const ref` declaration. Taking a `ref` or `const ref` of either will return `undefined`.

The behavior of a reference declaration can be illustrated by the following syntactic conversion:

```js
function f(ref y) {
  y = 1;
}

let ref x1 = someRef;
x1 = 1;

const ref x2 = someRef;
console.log(x2);
```

is roughly identical in its behavior to:

```js
function f(ref_y) {
  ref_y.value = 1;
}

let ref_x1 = someRef;
ref_x1.value = 1;

const ref_x2 = ((someRef) => Object.freeze({ 
  __proto__: Reference.prototype,
  get value() { return someRef.value; }
}))(someRef);
console.log(ref_x2.value);
```

## `ref` assignments

A `ref` assignment allows the reassignment of the `Reference` to which a **mutable** `ref` declaration is bound.

`ref` assignments have the following semantics:
  * A `ref` assignment is unambiguously a _dereference_ of some `Reference` object. Host engines can leverage this fact to optimize away 
    the `Reference` object if they can statically determine that the only use-sites are arguments to call expressions whose parameters
    are declared `ref` (i.e., `ref x = ref y` does not require the allocation of a `Reference` object).
  * A `ref` assignment can only appear on the left-hand side of an assignment expression, or as the assignment target of an Object or Array assignment pattern.
  * A `ref` assignment is a simple assignment target.
  * The operand for a `ref` assignment is an `IdentifierReference`.
  * The value assigned to a `ref` assignment must either be a **mutable** `Reference`, `undefined`, or `null`.
  * If the value assigned to a `ref` assignment is an **immutable** `Reference`, an error is thrown.
  * There is no `const ref` assignment as you cannot reassign a constant variable.
  * You cannot perform a `ref` assignment to a value not already declared as a `ref` declaration (i.e., `let x; ref x = ref y` is an error).

## `Reference` objects

A `Reference` object is a reified reference that contains a `value` property that can be used to read from and write to a reference.

Reference objects have the following shape:

```ts
interface Reference<T> {
   value: T;
   [Symbol.toStringTag]: "Reference";
}
var Reference: {
  /**
   * Returns whether a `Reference` is writable.
   */
  isWritable(x): boolean;
}
```

## `const` parameters

As a byproduct of the addition of `const ref` parameters, we optionally define a `const` parameter as a parameter in a function whose value cannot be changed.

# Examples

Take a reference to a variable:
```js
let x = 1;
const r = ref x;
print(r.value); // 1
r.value = 2;
print(x); // 2;
```

Take a reference to a property:
```js
let o = { x: 1 };
const r = ref o.x;
print(r.value); // 1
r.value = 2;
print(o); // { x: 2 }
```

Take a reference to an element:
```js
let ar = [1];
const r = ref ar[0];
print(r.value); // 1
r.value = 2;
print(ar); // [2]
```

Object Binding Patterns:
```js
// given:
let o = { x: 1 };

// both references `o.x` and dereferences to the binding `a`
let { ref x: a } = o;  // same as `let ref a = ref o.x`
print(a); // 1
a++;
print(o); // { x: 2 }

// both references `o.x` and dereferences to the binding `x`
let { ref x } = o; // similar to `let ref x = ref o.x`
print(x); // 2
x++;
print(o); // { x: 3 }
```

Array Binding Patterns:
```js
// NOTE: If an Array Binding Pattern has a `ref` declaration, array indexing is used 
// instead of Symbol.iterator and rest elements are not allowed.

// given:
let ar = [1];

// references `ar[0]` and dereferences to the binding `a`
let [ref a] = ar; // similar to `let ref a = ar[0];`
print(a); // 1
a = 2;
print(ar); // [2]
```

Dereferencing:
```js
// dereference a binding
let x = 1;
let ref y = ref x; // 'y' effectively points to 'x'
print(y); // 1
y = 2;
print(x); // 2
```

Dereferencing a non-Reference (other than `undefined` or `null`) is a **ReferenceError**:
```js
let x = 1;
let ref y = x; // TypeError: Value is not a Reference.
```

Dereferencing `undefined` or `null` is ok, but accessing its value is a **ReferenceError** (`typeof` can still be used to test the reference):
```js
function f(ref y) {
  typeof y; // ok, type is 'undefined' 
  y; // ReferenceError: y is not defined.
}
f(undefined); // ok

let x;
function g(ref y = ref x) {}
g(); // ok, parameter initialization will check whether the *argument* is undefined, not the binding.
```

Dereferencing an immutable Reference into a mutable Reference results in an error:
```js
let x = 1;
const ref y = const ref x; // ok, `x` is mutable
let ref z = ref y; // error
```

Reference passing:
```js
function update(ref r) {
  r = 2;
}

let x = 1;
update(ref x);
print(x); // 2
```

Referencing a local declaration creates a closure:
```js
function f() {
  let x = 1;
  return [ref x, () => print(x)];
}

const [ref r, p] = f();
print(r); // 1
r = 2;
p(); // 2
```

Combining reference expressions, reference parameters, and reference variables:
```js
function max(ref first, ref second, ref third) {
  let ref max = first > second ? ref first : ref second;
  return max > third ? ref max : ref third;
}

let x = 1, y = 2, z = 3;
let ref w = max(ref x, ref y, ref z);
w = 4;
print(x); // 1
print(y); // 2
print(z); // 4
```

Forward reference to a block-scoped variable and TDZ:
```js
let ref a_ = ref a; // ok, no error from TDZ
let a = 1;

let ref b_ = ref b;
b_ = 1; // error due to TDZ
let b; 
```

Forward reference to member of block-scoped variable:
```js
let ref b_ = ref b.x; // error, TDZ for `b`
let b = { x: 1 };
```

Forward reference to `var`:
```js
let ref d_ = ref d; // ok, no TDZ
d_ = 2; // ok
var d = 1;
```

Forward references for decorators:
```js
class Node {
  @Type(ref Container) // ok, no error due to TDZ
  get parent() { /*...*/ }
  @Type(ref Node)
  get nextSibling() { /*...*/ }
}
class Container extends Node {
  @Type(ref Node)
  get firstChild() { /*...*/ }
}
```

Side effects:
```js
let count = 0;
let e = [0, 1, 2];
let ref e_ = ref e[count++]; // `count++` evaluated when reference is taken.
print(e_); // 0
print(e_); // 0
print(count); // 1
```

# Grammar

```grammarkdown
LeftHandSideExpression[Yield, Await]:
  `const`? `ref` LeftHandSideExpression[?Yield, ?Await]

RefBinding[Yield, Await, ConstRef]:
  `ref` BindingIdentifier[?Yield, ?Await]
  [+ConstRef] `const` `ref` BindingIdentifier[?Yield, ?Await]

LexicalBinding[In, Yield, Await]:
  RefBinding[?Yield, ?Await, ~ConstRef] Initializer[?In, ?Yield, ?Await]?

VariableDeclaration[In, Yield, Await]:
  RefBinding[?Yield, ?Await, ~ConstRef] Initializer[?In, ?Yield, ?Await]?

ForBinding[Yield, Await]:
  RefBinding[?Yield, ?Await, ~ConstRef]

FormalParameter[Yield, Await]:
  `const`? BindingElement[?Yield, ?Await, ~ConstRef]
  
BindingElement[Yield, Await, ConstRef]:
  SingleNameBinding[?Yield, ?Await, ?ConstRef]
  BindingPattern[?Yield, ?Await, ?ConstRef] Initializer[+In, ?Yield, ?Await]?

SingleNameBinding[Yield, Await, ConstRef]:
  RefBinding[?Yield, ?Await, ?ConstRef] Initializer[+In, ?Yield, ?Await]?
```

In certain circumstances when processing an instance of the production
```grammarkdown
AssignmentExpression: LeftHandSideExpression `=` AssignmentExpression
```
the interpretation of `LeftHandSideExpression` is refined using the following grammar:

```grammarkdown
AssignmentPattern[Yield, Await]:
   ...
   RefBinding[?Yield, ?Await, ~ConstRef]  
```

# Desugaring

The following is an approximate desugaring for this proposal:

```js
// proposed syntax
function max(ref first, ref second, ref third) {
  let ref max = first > second ? ref first : ref second;
  return max > third ? ref max : ref third;
}

let x = 1, y = 2, z = 3;
let ref w = max(ref x, ref y, ref z);
w = 4;
print(x); // 1
print(y); // 2
print(z); // 4

// desugaring
const __ref = (get, set) => Object.freeze(Object.create(null, { value: { get, set } }));

function max(ref_first, ref_second, ref_third) {
  let ref_max = ref_first.value > ref_second.value ? ref_first : ref_second;
  return ref_max.value > ref_third.value ? ref_max : ref_third;
}

let x = 1, y = 2, z = 3;
const ref_x = __ref(() => x, _ => x = _);
const ref_y = __ref(() => y, _ => y = _);
const ref_z = __ref(() => z, _ => z = _);
const ref_w = max(ref_x, ref_y, ref_z);
ref_w.value = 4;
print(x); // 1
print(y); // 2
print(z); // 4
```

And here's the same example using an array:

```js
// proposed syntax
function max(ref first, ref second, ref third) {
  let ref max = first > second ? ref first : ref second;
  return max > third ? ref max : ref third;
}

// arrays
let ar = [1, 2, 3];
let ref w = max(ref ar[0], ref ar[1], ref ar[2]);
w = 4;
print(ar[0]); // 1;
print(ar[1]); // 2;
print(ar[2]); // 4;

// desugaring
const __ref = (get, set) => Object.freeze(Object.create(null, { value: { get, set } }));
const __elemRef = (o, p) => __ref(() => o[p], _ => o[p] = _);

function max(ref_first, ref_second, ref_third) {
  let ref_max = ref_first.value > ref_second.value ? ref_first : ref_second;
  return ref_max.value > ref_third.value ? ref_max : ref_third;
}

let ar = [1, 2, 3];
const ref_ar0 = __elemRef(ar, 0);
const ref_ar1 = __elemRef(ar, 1);
const ref_ar2 = __elemRef(ar, 2);
const ref_w = max(ref_x, ref_y, ref_z);
ref_w.value = 4;
print(ar[0]); // 1;
print(ar[1]); // 2;
print(ar[2]); // 4;
```

Here's an example using private names:

```js
// proposed syntax
class C {
  #counter = 0;
  get count() { return this.#counter; }
  provideCounter(cb) {
    cb(ref this.#counter);
  }
}

function increment(ref counter) {
  counter++;
}

const c = new C();
c.provideCounter(increment);
c.provideCounter(increment);
print(c.count); // 2

// desugared
const __ref = (get, set) => Object.freeze(Object.create(null, { value: { get, set } }));
class C {
  #counter = 0;
  get count() { return this.#counter; }
  provideCounter(cb) {
    cb(__ref(() => this.#counter, _ => this.#counter = _));
  }
}

function increment(ref_counter) {
  ref_counter.value++;
}

const c = new C();
c.provideCounter(increment);
c.provideCounter(increment);
print(c.count); // 2
```

# Future Considerations

We may want to make it possible to revoke a reference, for example:
```js
let a = 1;
let { ref reference: b, revoke } = Reference.revocable(ref a);
b = 2;
console.log(a); // 2
revoke();
b = 3; // ReferenceError
```

However, it may be possible to do this in userland (though engines may not be able to optimize away a userland type):
```js
function revocableReference(ref_value) {
  const reference = Object.create(Reference.prototype, {
    value: {
      get() { 
        if (ref_value === null) throw new ReferenceError();
        return ref_value.value;
      },
      set(v) {
        if (ref_value === null) throw new ReferenceError();
        ref_value.value = v;
      }
    }
  });
  function revoke() {
    ref_value = null;
  }
  return { reference, revoke };
}

let a = 1;
let { ref reference: b, revoke } = revocableReference(ref a);
b = 2;
console.log(a); // 2
revoke();
b = 3; // ReferenceError
```

