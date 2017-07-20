# Reference (`&`) declarations and expressions for ECMAScript

This proposal defines new syntax to allow for the declaration and creation of user-defined references to bindings.

# Motivations

* Decorators cannot refer to block-scoped declarations that follow them.
* Simplifies capturing references to bindings in one scope and handing it to another scope.

# Prior Art
* https://github.com/dotnet/roslyn/issues/118

# Proposal

This proposal introduces three main concepts: 

* Reference expressions (e.g. `const r = &x`)
* Reference declarations (e.g. `const &y = r`)
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
const x = &y;
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
    are declared `&`.

The behavior of a reference declaration can be illustrated by the following syntactic conversion:

```js
function f(&y) {
  y = 1;
}
```

is roughly identical in its behavior to:

```js
function f(ref_y) {
  ref_y.value = 1;
}
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
const r = &x;
print(r.value); // 1
r.value = 2;
print(x); // 2;
```

Take a reference to a property:
```js
let o = { x: 1 };
const r = &o.x;
print(r.value); // 1
r.value = 2;
print(o); // { x: 2 }
```

Take a reference to an element:
```js
let ar = [1];
const r = &ar[0];
print(r.value); // 1
r.value = 2;
print(ar); // [2]
```

Dereferencing:
```js
// dereference a binding
let x = 1;
let &y = &x;
print(y); // 1
y = 2;
print(x); // 2
```

Dereferencing a non-Reference object is a **TypeError**:
```js
let x = 1;
let &y = x; // TypeError: Value is not a Reference.
```

Reference passing:
```js
function update(&r) {
  r = 2;
}

let x = 1;
update(&x);
print(x); // 2
```

Referencing a local declaration creates a closure:
```js
function f() {
  let x = 1;
  return [&x, () => print(x)];
}

const [r, p] = f();
print(r.value); // 1
r.value = 2;
p(); // 2
```

Combining reference expressions, reference parameters, and reference variables:
```js
function max(&first, &second, &third) {
  const &max = first > second ? &first : &second;
  return max > third ? &max : &third;
}

let x = 1, y = 2, z = 3;
let &w = max(&x, &y, &z);
w = 4;
print(x); // 1
print(y); // 2
print(z); // 4
```

Forward reference to a block-scoped variable and TDZ:
```js
let &a_ = &a; // ok, no error from TDZ
let a = 1;

let &b_ = &b;
b_ = 1; // error due to TDZ
let b; 
```

Forward reference to member of block-scoped variable:
```js
let &b_ = &b.x; // error, TDZ for `b`
let b = { x: 1 };
```

Forward reference to `var`:
```js
let &d_ = &d; // ok, no TDZ
d_ = 2; // ok
var d = 1;
```

Forward references for decorators:
```js
class Node {
  @Type(&Container) // ok, no error due to TDZ
  get parent() { /*...*/ }
  @Type(&Node)
  get nextSibling() { /*...*/ }
}
class Container extends Node {
  @Type(&Node)
  get firstChild() { /*...*/ }
}
```

Side effects:
```js
let count = 0;
let e = [0, 1, 2];
let &e_ = &e[count++]; // `count++` evaluated when reference is taken.
print(e_); // 0
print(e_); // 0
print(count); // 1
```

# Syntax

```grammarkdown
UnaryExpression[Yield, Await]:
  `&` UnaryExpression[?Yield, ?Await]

RefBinding[Yield, Await]:
  `&` BindingIdentifier[?Yield, ?Await]

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
function max(&first, &second, &third) {
  const &max = first > second ? &first : &second;
  return max > third ? &max : &third;
}

let x = 1, y = 2, z = 3;
let &w = max(&x, &y, &z);
w = 4;
print(x); // 1
print(y); // 2
print(z); // 4

// desugaring
function max(ref_first, ref_second, ref_third) {
  const ref_max = ref_first.value > ref_second.value ? ref_first : ref_second;
  return ref_max.value > ref_third.value ? ref_max : ref_third;
}

let x = 1, y = 2, z = 3;
const ref_x = Object.freeze({ get value() { return x; }, set value(_) { x = _; } });
const ref_y = Object.freeze({ get value() { return y; }, set value(_) { y = _; } });
const ref_z = Object.freeze({ get value() { return z; }, set value(_) { z = _; } });
const ref_w = max(ref_x, ref_y, ref_z);
ref_w.value = 4;
print(x); // 1
print(y); // 2
print(z); // 4
```
