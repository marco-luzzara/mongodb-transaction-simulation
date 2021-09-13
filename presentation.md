# MongoDB Transactions

---

## What is a transaction?

*"A transaction is a logical unit of work that contains one or more SQL statements. A transaction is an atomic unit. The effects of all the SQL statements in a transaction can be either all committed (applied to the database) or all rolled back (undone from the database)."*

<a style="font-size:0.4em; float: right" href="https://docs.oracle.com/cd/B19306_01/server.102/b14220/transact.htm">Oracle, Transaction management <a/>

---

## Do I really need them in a NoSQL DBMS?
* Resource-demanding and very slow compared to non-transactional operations <!-- .element: class="fragment fade-in-then-semi-out" data-fragment-index="1" -->
* In NoSQL applications we can generally find a way around ACID requirements by: <!-- .element: class="fragment" data-fragment-index="2" -->
  * Allowing temporary issues - Social media <!-- .element: style="color: white" class="fragment fade-in-then-semi-out" data-fragment-index="3" -->
  * Optimistic/Pessimistic concurrency control - Airplane Ticketing and online shops<!-- .element: class="fragment fade-in-then-semi-out" data-fragment-index="4" -->
  * Transaction-less approach - Ebay <!-- .element: class="fragment fade-in-then-semi-out" data-fragment-index="5" -->

---

<!-- .slide: data-font-size="15%" -->

### You need them less than you think...

What if I need to update many accounts of the same user **atomically**?

<div style="display: flex; gap: 5%; font-size: 25px">
<div style="flex: 1">
<pre class="code-wrapper" style>
    <code class="hljs dts">// Users
{
    _id: 1,
    email: x
}
// Accounts
{
    _id: 1,
    userId: 1
}
{
    _id: 2,
    userId: 1
}</code>
</pre>
<div class="fragment" data-fragment-index="1">❌</div>
</div>

<div style="flex: 1">
<pre style="flex: 1" class="code-wrapper" style>
    <code class="hljs dts">// Users

{
    _id: 1,
    email: x,
    accounts: [
        {
            _id: 1
        },
        {
            _id: 2
        }
    ]
}</code>
</pre>
<div class="fragment" data-fragment-index="1">✅</div>
</div>
</div>

---

### Finally, transactions in MongoDB

* Introduced in version 4.0 but limited to the same replica set, from 4.2 extended to the whole cluster <!-- .element: class="fragment fade-in-then-semi-out" data-fragment-index="1" -->
* Designed to be very similar to SQL transactions <!-- .element: class="fragment fade-in-then-semi-out" data-fragment-index="2" -->
* They guarantee ACID properties, but how? <!-- .element: class="fragment fade-in-then-semi-out" data-fragment-index="3" -->

---

## Atomicity 
