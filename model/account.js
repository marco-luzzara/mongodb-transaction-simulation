class Account {
    constructor(owner, balance) {
        this.owner = owner;
        this.balance = this._validateBalance(balance);
    }

    _validateBalance(balance) {
        if (!Number.isInteger(balance))
            throw new Error("balance is not an integer");

        return balance;
    }
}

module.exports = Account;