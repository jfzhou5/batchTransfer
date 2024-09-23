import { Address, address, beginCell, Slice, toNano } from '@ton/core';
import { BatchTransfer } from '../wrappers/BatchTransfer';
import { NetworkProvider } from '@ton/blueprint';
import { TESTNET_ADDRESS } from '../helpers/constant';
import { SampleJetton } from '../wrappers/SampleJetton';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
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

    // withdraw jetton from contract
    await batchTransfer.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'WithdrawJetton',
            selfJettonWallet: batchTransferJettonWallet.address,
            to: userAddress,
            amount: (await batchTransferJettonWallet.getGetWalletData()).balance,
        },
    );
    await waitForTx(provider, batchTransferJettonWallet.address);
}
