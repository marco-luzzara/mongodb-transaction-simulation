class MoneyTransaction {
    constructor(from, to, value) {
        this.from = from;
        this.to = to;
        this.value = this._validateValue(value);
    }

    _validateValue(value) {
        if (!Number.isInteger(value))
            throw new Error("balance is not an integer");

        if (value <= 0)
            throw new Error("cannot move a negative amount of money");

        return value;
    }
}

module.exports = MoneyTransaction;