import "./jetton-master";
message Mint {
    amount: Int;
    receiver: Address;
}
message Mintable {
    mintable: Bool;
}

contract SampleJetton with Jetton {
    totalSupply: Int as coins;
    max_supply: Int as coins;
    owner: Address;
    content: Cell;
    mintable: Bool;
    init(owner: Address, content: Cell, max_supply: Int){
        self.totalSupply = 0;
        self.max_supply = max_supply;
        self.owner = owner;
        self.mintable = true;
        self.content = content;
    }

    receive(msg: Mint){
        let ctx: Context = context();
        // require(ctx.sender == self.owner, "Not Owner");
        require(self.mintable, "Can't Mint Anymore");
        self.mint(msg.receiver, msg.amount, self.owner); //(to, amount, response_destination)
    }

    receive(msg: Mintable){
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Not Owner");
        self.mintable = msg.mintable;
    }
}