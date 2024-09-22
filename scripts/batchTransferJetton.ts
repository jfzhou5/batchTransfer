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
    const sam = provider.open(SampleJetton.fromAddress(address(TESTNET_ADDRESS.SAM)));
    const userJettonWallet = provider.open(JettonDefaultWallet.fromAddress(await sam.getGetWalletAddress(userAddress)));
    const batchTransferJettonWallet = provider.open(
        JettonDefaultWallet.fromAddress(await sam.getGetWalletAddress(batchTransfer.address)),
    );

    // build forward_payload
    const forward_payload: Slice = beginCell()
        .storeUint(0xc351d681, 32)
        .storeAddress(batchTransferJettonWallet.address) // jetton wallet of batchTransfer
        .storeRef(
            beginCell()
                .storeAddress(randomAddress()) // user1
                .storeUint(toNano(50), 120) // amount 1
                .storeAddress(randomAddress()) // user2
                .storeUint(toNano(50), 120) // amount2
                .endCell(),
        )
        .endCell()
        .asSlice();

    // await userJettonWallet.send(
    //     provider.sender(),
    //     {
    //         value: toNano('0.2'),
    //     },
    //     {
    //         $$type: 'TokenTransfer',
    //         queryId: 0n,
    //         amount: toNano(100),
    //         destination: batchTransfer.address,
    //         response_destination: userAddress,
    //         custom_payload: null,
    //         forward_ton_amount: toNano('0.15'),
    //         forward_payload,
    //     },
    // );

    // await waitForTx(provider, batchTransfer.address);

    // withdraw jetton from contract
    await batchTransfer.send(
        provider.sender(),
        {
            value: toNano("0.05")
        },
        {
            $$type: "WithdrawJetton",
            selfJettonWallet: batchTransferJettonWallet.address,
            to: userAddress,
            amount: (await batchTransferJettonWallet.getGetWalletData()).balance
        }
    )
    await waitForTx(provider, batchTransferJettonWallet.address);

}
