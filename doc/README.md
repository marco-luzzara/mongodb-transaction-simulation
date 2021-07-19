# MongoDB Transactions

Transactions have been introduced in MongoDB 4.0 with a limited support on replica sets only, from version 4.2 they are available in sharded clusters too. This feature was the result of 9 years of research and development from the MongoDB team, but the surprising fact is that performances of non-transactional operations were not degraded even after this additional complexity in the core logic. Essentially, upgrading to a transactions-supporting version of MongoDB would not make your application less performant. 

The purpose of this article is to explain what you can do with (and without) transactions in order to do the best choice in your production environment. Assuming you already know what a transaction is, I am starting with ACID properties and how MongoDB is able to guarantee them inside a transaction.

---

## ACID Properties

As I said, MongoDB Transactions gaurantee ACID properties, which are:

- **A**tomicity: all the operations in a transaction are committed or none of them are. This was made possible thanks to the integration of the WiredTiger storage engine, that uses a snapshot-based cache.
- **C**onsistency: a transaction, when committed, cannot bring the database to an invalid state. 
- **I**solation: isolation ensures that concurrent transactions cannot interfere with each other and with outside operations. In particular, MongoDB transaction operations are invisible until committed and many of the isolations problem can be solved using the appropriate `readConcern` configuration property.
- **D**urability: this property simply guarantee that, once a transaction commits, its changes are not lost even after a system failure. MongoDB lets you configure the durability by setting the `writeConcern` property. 

---

## Atomicity

Atomicity is a very difficult requirement in a NoDBMS like MongoDB. A reason could be that one of the priority of a NoSQL database is scaling: ensuring atomicity for a transaction that involves many shards must have been a demanding implementation. So, what are the changes that made this implementation possible?

### Wired Tiger Cache

The transaction path started when MongoDB team was using MMapV1, which provided ACID properties in a non-multi-document and non-multi-collection transaction. Next, they decided to integrate Wired Tiger as the primary storage layer and it is currently the default and only one supporting transactions. This storage engine leverages an internal in-memory cache to store the changes from the last snapshot before flushing them to disk.

This is extremely useful for transactions management: all the operations in a transaction are guaranteed to stay in memory until they are committed or rolled back. In this way, operations in a transaction are made persistent only when committed, and not in the middle of the transaction itself. The clear drawback is that in-memory cache size grows uncontrollably and outside operations are forced to stay in-memory as well, with a higher risk to be lost after a crash. This is the first reason why you should never abuse transactions, in particular long-running ones are discouraged.

### Sessions Id

---

## Consistency

Let's start by saying that consistency in ACID is not the same as consistency in the CAP theorem, which is about data freshness. Instead ACID consistency means keeping data correctness after the execution of a transaction.

---

## Isolation

With the isolation level you can establish whether a transaction can see writes inside another concurrent transaction. It is basically a tradeoff between performances (max with the lowest isolation level) and accuracy. Some issues could arise depending on the isolation level chosen, but you are not forced to patch them all: sometimes they are so unlikely that it is not worth giving up on performances. Some of these issues are:

- Dirty reads: a dirty read occurs when a transaction is allowed to read data from a row that has been modified by another running transaction and not yet committed.

    | time| t1 | t2 |
    |-----|----|----|
    | 0 | `SELECT age FROM users WHERE id = 1; /* will read 20 */` | |                                      
    | 1 |                                                          | `UPDATE users SET age = 21 WHERE id = 1; /* No commit here */` |
    | 2 | `SELECT age FROM users WHERE id = 1; /* will read 21 */` | |
    | 3 |                                                          | `ROLLBACK; /* lock-based DIRTY READ */` |

- Non-repeatable reads: a non-repatable read occurs when, during the course of a transaction, a row is retrieved twice and the values within the row differ between reads.

    | time | t1 | t2 |
    |------|----|----|
    | 0 | `SELECT * FROM users WHERE id = 1;`                     | |                                      
    | 1 |                                                         | `UPDATE users SET age = 21 WHERE id = 1; COMMIT;` |
    | 2 | `SELECT * FROM users WHERE id = 1; COMMIT;` | |


- Phantom reads: a phantom read occurs when, in the course of a transaction, new rows are added or removed by another transaction to the records being read.

    | time | t1 | t2 |
    |------|----|----|
    | 0 | `SELECT * FROM users WHERE age BETWEEN 10 AND 30;` | |
    | 1 |                                                    | `INSERT INTO users(id, name, age) VALUES (3, 'Bob', 27); COMMIT;` |
    | 2 | `SELECT * FROM users WHERE age BETWEEN 10 AND 30; COMMIT;` | |

---

## Durability

When this property is guaranteed data are durable even after a system crash. Conceptually, it is not a difficult idea, but in practice it is very hard to achieve: usually logs are used to temporarily  store data changes, and only in the end these logs are written on disk. 

---

## When do I need transactions in a NoSQL DBMS?
Transactions are very resource-demanding, it does not really matter if you are in a SQL or NoSQL context, they are generally very slow. Let's start by giving some example on when to **not** use transactions:

- Social media: dirty and phantom reads are usually ok, a page reload is enough most of the times.
- Airplane ticketing: in many airline companies, ticketing is not handled using transactions because the purchase confirmation is different than the seat assignment. Even if two customers succeed at buying the last ticket, one of them is going to receive an email cancel the booking. It is probably easier to handle it with an email than to always use transactions, since they might be useful only when there are a few seats left.

When we talk about transactions we always refer to database transactions, but there is also the possibility to use application-level transactions. Ebay is famous in this field because it decided to adopt a transactionless approach: this is complex on one side because you must make sure to maintain referential integrity and all the facilities a dbms provides. On the other side, distributed transactions, that are dangerous when your database is partitioned, are not used anymore. Last but not least, you have full control over the *transaction* process, by implementing it yourself.





