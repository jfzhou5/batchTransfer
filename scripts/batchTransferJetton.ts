import { Address, address, beginCell, Slice, toNano } from '@ton/core';
import { BatchTransfer } from '../wrappers/BatchTransfer';
import { NetworkProvider } from '@ton/blueprint';
import { TESTNET_ADDRESS } from '../helpers/constant';
import { SampleJetton } from '../wrappers/SampleJetton';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { randomAddress } from '@ton/test-utils';
import { waitForTx } from '../helpers/address';

export async function run(provider: NetworkProvider) {
    const userAddress = Address.parse(provider.sender().address?.toString() || '');

    const batchTransfer = provider.open(BatchTransfer.fromAddress(address(TESTNET_ADDRESS.BatchTransfer)));
    // Jetton address
    const sam = provider.open(SampleJetton.fromAddress(address(TESTNET_ADDRESS.SAM)));
    // jetton wallet of user
    const userJettonWallet = provider.open(JettonDefaultWallet.fromAddress(await sam.getGetWalletAddress(userAddress)));
    // jetton wallet of batchTransfer contract
    const batchTransferJettonWallet = provider.open(
        JettonDefaultWallet.fromAddress(await sam.getGetWalletAddress(batchTransfer.address)),
    );
    // support max user count:
    const users = new Array(8).fill(0).map((_) => randomAddress());
    const userAmount = toNano(50);
    // require tokenTransfer amount = sum(user amount)
    const amount = userAmount * 8n;

    // build forward_payload
    const forward_payload: Slice = beginCell()
        .storeUint(0xe5d5a095, 32) // opcode of `BatchTransferJetton`
        .storeAddress(batchTransferJettonWallet.address) // jetton wallet of batchTransfer contract
        .storeRef(
            beginCell()
                .storeAddress(users[0])
                .storeUint(userAmount, 120)
                .storeAddress(users[1])
                .storeUint(userAmount, 120)
                .endCell(),
        )
        .storeRef(
            beginCell()
                .storeAddress(users[2])
                .storeUint(userAmount, 120)
                .storeAddress(users[3])
                .storeUint(userAmount, 120)
                .endCell(),
        )
        .storeRef(
            beginCell()
                .storeAddress(users[4])
                .storeUint(userAmount, 120)
                .storeAddress(users[5])
                .storeUint(userAmount, 120)
                .endCell(),
        )
        .storeRef(
            beginCell()
                .storeAddress(users[6])
                .storeUint(userAmount, 120)
                .storeAddress(users[7])
                .storeUint(userAmount, 120)
                .endCell(),
        )
        .endCell()
        .asSlice();

    const forward_ton_amount = toNano(0.05) * (8n + 1n);
    const totalFee = forward_ton_amount + toNano(0.05);

    await userJettonWallet.send(
        provider.sender(),
        {
            value: totalFee,
        },
        {
            $$type: 'TokenTransfer',
            queryId: 0n,
            amount,
            destination: batchTransfer.address,
            response_destination: userAddress,
            custom_payload: null,
            forward_ton_amount,
            forward_payload,
        },
    );

    await waitForTx(provider, batchTransfer.address);
}
