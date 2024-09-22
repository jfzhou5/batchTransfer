import "@stdlib/deploy";
import "@stdlib/ownable";
import "./jetton/messages.tact";

struct Configs {
    owner: Address;
    ownerRate: Int;
}

message SetOwnerRate {
    rate: Int;
}

message WithdrawJetton {
    selfJettonWallet: Address;
    to: Address;
    amount: Int;
}

contract BatchTransfer with Deployable, Ownable {
    override const storageReserve: Int = ton("0.005");
    const PARSE_TOKEN_TRANSFER_PAYLOAD_GAS_CONSUMPTION: Int = ton("0.006");
    const TOKEN_TRANSFER_GAS_CONSUMPTION: Int = ton("0.05");
    const BASE_RATE: Int = 10000;
    owner: Address;
    ownerRate: Int;
    init(){
        self.owner = sender();
        self.ownerRate = 1000; // 10%
    }

    receive(msg: SetOwnerRate){
        self.requireOwner();
        require(msg.rate <= self.BASE_RATE, "Invalid owner rate");
        self.ownerRate = msg.rate;
        self.forward(self.owner, emptyCell(), false, null);
    }

    receive(msg: WithdrawJetton) {
        self.requireOwner();
        self.forward(msg.selfJettonWallet,
            TokenTransfer{
                queryId: 0,
                amount: msg.amount,
                destination: msg.to,
                response_destination: sender(),
                custom_payload: null,
                forward_ton_amount: 0,
                forward_payload: emptySlice()
            }.toCell(),
            false,
            null
        );
    }

    receive(msg: TokenNotification){
        // crc32 batchTransferJetton: 0xc351d681
        // crc32 batchTransferTon: 0xc38a3a6f
        let ctx: Context = context();
        let payload: Slice = msg.forward_payload;
        let opcode: Int = payload.loadUint(32);
        let selfJettonWallet: Address = payload.loadAddress();
        if (opcode == 0xc351d681) {
            let addressAndAmount: map<Address, Int> = emptyMap();
            let sumAmount: Int = 0;
            let userCount: Int = 0;
            while (!payload.refsEmpty()) {
                let refPayload: Slice = payload.loadRef().asSlice();
                while (!refPayload.empty()) {
                    let user: Address = refPayload.loadAddress();
                    let amount: Int = refPayload.loadUint(120);
                    addressAndAmount.set(user, amount * (self.BASE_RATE - self.ownerRate) / self.BASE_RATE);
                    sumAmount += amount;
                    userCount += 1;
                }
            }

            require(sumAmount == msg.amount, "BatchTransfer amount error");
            // Gas checks
            let fwdFee: Int = ctx.readForwardFee() * userCount;
            let totalFee: Int = self.TOKEN_TRANSFER_GAS_CONSUMPTION * userCount
                + self.storageReserve
                + self.PARSE_TOKEN_TRANSFER_PAYLOAD_GAS_CONSUMPTION
                + fwdFee;
            require(ctx.value >= totalFee, "Invalid fee");

            foreach (user, amount in addressAndAmount) {
                send(SendParameters{
                    to: selfJettonWallet,
                    value: self.TOKEN_TRANSFER_GAS_CONSUMPTION,
                    mode: SendPayGasSeparately,
                    bounce: false,
                    body: TokenTransfer{
                        queryId: 0,
                        amount: amount,
                        destination: user,
                        response_destination: msg.from,
                        custom_payload: null,
                        forward_ton_amount: 0,
                        forward_payload: emptySlice()
                    }.toCell()
                })
            }

            // cashback
            send(SendParameters{
                to: msg.from,
                value: self.remainingValue(ctx.value, totalFee),
                mode: SendIgnoreErrors,
                bounce: false,
                body: emptyCell()
            });
        }

    }

    get fun remainingValue(value: Int, selfConsumption: Int): Int {
        let msgValue: Int = value;
        let tonBalanceBeforeMsg: Int = myBalance() - msgValue;
        let storageFee: Int = self.storageReserve - min(tonBalanceBeforeMsg, self.storageReserve);
        msgValue = msgValue - (storageFee + selfConsumption);
        return msgValue;
    }

    get fun configs(): Configs {
        return Configs{
            owner: self.owner,
            ownerRate: self.ownerRate
        };
    }
}