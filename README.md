# Ref declarations and expressions for ECMAScript

This proposal defines new syntax to allow for the declaration and creation of user-defined references to bindings.

# Motivations

* Decorators cannot refer to block-scoped declarations that follow them.
* Simplifies capturing references to bindings in one scope and handing it to another scope.

# Prior Art
* https://github.com/dotnet/roslyn/issues/118

# Proposal

This proposal introduces two main concepts: 

* `ref` expressions - A prefix unary expression that creates a "reference object" that defines a binding to its operand.
  The operand must be a valid simple assignment target.
* `ref` declarations - A declaration of a parameter or variable that dereferences a "reference object", creating a binding 
  in the current scope to the target of the "reference object".
  
# Examples

```js
// get a 'ref' to a variable
let x = 1;
const r = ref x;
print(r.value); // 1
r.value = 2;
print(x); // 2;
```

```js
// dereference a binding
let x = 1;
ref y = ref x;
print(y); // 1
y = 2;
print(x); // 2
```

```js
// dereference a non-reference object
let x = 1;
ref y = x; // TypeError: Value is not a reference.
```

```js
// hand a reference to another function
function update(ref r) {
  r = 2;
}

let x = 1;
update(ref x);
print(x); // 2
```

```js
// return a reference from a function
function f() {
  let x = 1;
  return [ref x, () => print(x)];
}

const [r, p] = f();
print(r.value); // 1
r.value = 2;
p(); // 2
```

```js
// combining ref expressions, ref parameters, and ref variables
function max(ref first, ref second, ref third) {
  ref max = first > second ? ref first : ref second;
  return max > third ? ref max : ref third;
}

let x = 1, y = 2, z = 3;
ref w = max(ref x, ref y, ref z);
w = 4;
print(x); // 1
print(y); // 2
print(z); // 4
```

```js
// forward references for decorators
class Node {
  @Type(ref Container)
  get parent() { /*...*/ }
  @Type(ref Node)
  get nextSibling() { /*...*/ }
}
class Container extends Node {
  @Type(ref Node)
  get firstChild() { /*...*/ }
}
```

# Syntax

```grammarkdown
UnaryExpression[Yield] :
    `ref` [no LineTerminator here] UnaryExpression[?Yield]

RefBinding[Yield] :
    `ref` [no LineTerminator here] BindingIdentifier[?Yield]

LexicalBinding[In, Yield] :
    RefBinding[?Yield] Initializer[?In, ?Yield]?

VariableDeclaration[In, Yield] :
    RefBinding[?Yield] Initializer[?In, ?Yield]?

SingleNameBinding[Yield] :
    RefBinding[?Yield] Initializer[+In, ?Yield]?
```

# Desugaring

The following is an approximate desugaring for this proposal:

```js
// proposed syntax
function max(ref first, ref second, ref third) {
  ref max = first > second ? ref first : ref second;
  return max > third ? ref max : ref third;
}

let x = 1, y = 2, z = 3;
ref w = max(ref x, ref y, ref z);
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
