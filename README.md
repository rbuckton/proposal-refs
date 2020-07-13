# Reference (`ref`) declarations and expressions for ECMAScript

This proposal defines new syntax to allow for the declaration and creation of user-defined references to bindings.

# Motivations

* Decorators cannot refer to block-scoped declarations that follow them.
* Simplifies capturing references to bindings in one scope and handing it to another scope.

# Prior Art
* https://github.com/dotnet/roslyn/issues/118

# Proposal

This proposal introduces three main concepts: 

* Reference expressions (e.g. `let r = ref x`)
* Reference declarations (e.g. `let ref y = r`, or `function f(ref y) { }`)
* `Reference` objects

## Reference expressions

A Reference expression is a prefix unary expression that creates a `Reference` object that defines a binding to its operand.

Reference expressions have the following semantics:
  * The operand must be a valid simple assignment target. 
  * When the operand is a property accessor using dot notation, the target of the property accessor is evaluated immediately 
    and a `Reference` object is created for the actual property access.
  * When the operand is a property accessor using bracket notation, the target and the expression of the accessor are evaluated
    immediately and a `Reference` object is created for the actual property access.
  * When the operand is an identifier, a `Reference` object is created for the binding.
  * A Reference expression is unambiguously a reference to a binding. Host engines can leverage this fact to optimize reference passing.

This behavior can be illustrated by the following syntactic conversion:

```js
const x = ref y;
```

is roughly identical in its behavior to:

```js
const x = Object.freeze({ 
  __proto__: Reference.prototype,
  get value() { return y; }, 
  set value(_) { y = _; }
});
```

## Reference declarations

A Reference declaration is the declaration of a parameter or variable that dereferences a `Reference`, creating a binding 
in the current scope.

Reference declarations have the following semantics:
  * A Reference declaration is unambiguously a dereference of some Reference expression. Host engines can leverage this fact to optimize away 
    the `Reference` object if they can statically determine that the only use-sites are arguments to call expressions whose parameters
    are declared `ref`.
  * A `ref x` parameter introduces a mutable binding to the underlying `Reference`. 
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` assigns to the value of the underlying `Reference`.
  * A `let ref x` declaration introduces a mutable binding to the `Reference` supplied as the initializer.
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` assigns to the value of the underlying `Reference`.
  * A `const ref x` declaration introduces an immutable binding.
    * Reading from `x` reads the value of the underlying `Reference`. 
    * Assigning to `x` is an error.
    * Taking a `ref` of `x` will result in an immutable `Reference`.

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

## `Reference` objects

A `Reference` object is a reified reference that contains a `value` property that can be used to read from and write to a reference.

Reference objects have the following shape:

```ts
interface Reference<T> {
   value: T;
   [Symbol.toStringTag]: "Reference";
}
```

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
let o = { x: 1 };
const { ref x } = o;
// or:
// const { x: ref x } = 0;
print(x.value); // 1
x.value = 2;
print(o); // { x: 2 }
```

Array Binding Patterns:
```js
// NOTE: If an Array Binding Pattern has a `ref` declaration, array indexing is used 
// instead of Symbol.iterator and rest elements are not allowed.
let ar = [1];
const [ref r] = ar;
print(r.value); // 1
r.value = 2;
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

Dereferencing a non-Reference (other than `undefined`) is a **ReferenceError**:
```js
let x = 1;
let ref y = x; // TypeError: Value is not a Reference.
```

Dereferencing `undefined` is ok, but accessing its value is a **ReferenceError** (`typeof` can still be used to test the reference):
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

Dereferencing an immutable Reference into a mutable Reference does not make it mutable:
```js
let x = 1;
const ref y = ref x; // ok, `x` is mutable
let ref z = ref y; // ok, but `z` is actually immutable
z = 2; // error
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

const [r, p] = f();
print(r.value); // 1
r.value = 2;
p(); // 2
```

Combining reference expressions, reference parameters, and reference variables:
```js
function max(ref first, ref second, ref third) {
  const ref max = first > second ? ref first : ref second;
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
UpdateExpression[Yield, Await]:
  `ref` LeftHandSideExpression[?Yield, ?Await]

RefBinding[Yield, Await]:
  `ref` BindingIdentifier[?Yield, ?Await]

LexicalBinding[In, Yield, Await]:
  RefBinding[?Yield, ?Await] Initializer[?In, ?Yield, ?Await]?

VariableDeclaration[In, Yield, Await]:
  RefBinding[?Yield, ?Await] Initializer[?In, ?Yield, ?Await]?

ForBinding[Yield, Await]:
  RefBinding[?Yield, ?Await]

SingleNameBinding[Yield, ?Await]:
  RefBinding[?Yield, ?Await] Initializer[+In, ?Yield, ?Await]?
```

# Desugaring

The following is an approximate desugaring for this proposal:

```js
// proposed syntax
function max(ref first, ref second, ref third) {
  const ref max = first > second ? ref first : ref second;
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
  const ref_max = ref_first.value > ref_second.value ? ref_first : ref_second;
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
  const ref max = first > second ? ref first : ref second;
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
  const ref_max = ref_first.value > ref_second.value ? ref_first : ref_second;
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
