import "./messages";
import "./types";

@interface("org.ton.jetton.wallet")
contract JettonDefaultWallet
{
    const minTonsForStorage: Int = ton("0.01");
    const gasConsumption: Int = ton("0.01");
    balance: Int;
    owner: Address;
    master: Address;
    init(master: Address, owner: Address){
        self.balance = 0;
        self.owner = owner;
        self.master = master;
    }

    receive(msg: TokenTransfer){
        // 0xf8a7ea5
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.owner, "Invalid sender");
        let fwdFee: Int = ctx.readForwardFee() + ctx.readForwardFee(); // Gas checks
        let final: Int = ((2 * self.gasConsumption) + self.minTonsForStorage) + fwdFee;
        require(ctx.value > min(final, ton("0.01")), "Invalid value!!");

        self.balance = self.balance - msg.amount; // Update balance
        require(self.balance >= 0, "Invalid balance");
        let init: StateInit = initOf JettonDefaultWallet(self.master, msg.destination);
        let walletAddress: Address = contractAddress(init);
        send(SendParameters{
                to: walletAddress,
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: TokenTransferInternal{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    from: self.owner,
                    response_destination: msg.response_destination,
                    forward_ton_amount: msg.forward_ton_amount,
                    forward_payload: msg.forward_payload
                }.toCell(),
                code: init.code,
                data: init.data
            }
        );
    }

    receive(msg: TokenTransferInternal){
        // 0x178d4519
        let ctx: Context = context();
        if (ctx.sender != self.master) {
            let sInit: StateInit = initOf JettonDefaultWallet(self.master, msg.from);
            require(contractAddress(sInit) == ctx.sender, "Invalid sender!");
        }
        self.balance = self.balance + msg.amount;
        require(self.balance >= 0, "Invalid balance"); // Update balance

        if (msg.forward_ton_amount > 0) {
            send(SendParameters{
                    to: self.owner,
                    value: msg.forward_ton_amount,
                    bounce: false,
                    body: TokenNotification{ // 0x7362d09c - notify new owner
                        queryId: msg.queryId,
                        amount: msg.amount,
                        from: msg.from,
                        forward_payload: msg.forward_payload
                    }.toCell()
                }
            );
        }
        let msgValue: Int = self.msgValue(ctx.value); // Get value for gas
        let fwdFee: Int = ctx.readForwardFee();
        msgValue = (msgValue - msg.forward_ton_amount) - fwdFee;

        // msgValue = msgValue - msg.forward_ton_amount - min(fwdFee, ton("0.01"));

        if (msg.response_destination != null) {
            // Cashback
            send(SendParameters{
                    to: msg.response_destination!!,
                    value: msgValue,
                    bounce: false,
                    body: TokenExcesses{queryId: msg.queryId}.toCell(), // 0xd53276db
                    mode: SendIgnoreErrors
                }
            );
        }
    }

    get fun msgValue(value: Int): Int {
        let tonBalanceBeforeMsg: Int = myBalance() - value;
        let storageFee: Int = self.minTonsForStorage - min(tonBalanceBeforeMsg, self.minTonsForStorage);
        value -= storageFee + self.gasConsumption;
        return value;
    }

    receive(msg: TokenBurn){
        let ctx: Context = context();
        require(ctx.sender == self.owner, "Invalid sender"); // Check sender

        self.balance = self.balance - msg.amount; // Update balance
        require(self.balance >= 0, "Invalid balance");
        let fwdFee: Int = ctx.readForwardFee(); // Gas checks
        require(ctx.value > ((fwdFee + (2 * self.gasConsumption)) + self.minTonsForStorage), "Invalid value - Burn");
        send(SendParameters{ // Burn tokens
                to: self.master,
                value: 0,
                mode: SendRemainingValue,
                bounce: true,
                body: TokenBurnNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    owner: self.owner,
                    response_destination: self.owner
                }.toCell()
            }
        );
    }

    bounced(msg: Slice){
        let op: Int = msg.loadUint(32);
        let queryId: Int = msg.loadUint(64);
        let jettonAmount: Int = msg.loadCoins();
        require(op == 0x178d4519 || op == 0x7bdd97de, "Invalid bounced message");
        self.balance = self.balance + jettonAmount; // Update balance
    }

    get fun get_wallet_data(): JettonWalletData {
        return
            JettonWalletData{
                balance: self.balance,
                owner: self.owner,
                master: self.master,
                walletCode: initOf JettonDefaultWallet(self.master, self.owner).code
            };
    }
}