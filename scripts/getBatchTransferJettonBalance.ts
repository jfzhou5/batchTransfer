import { Address, address, beginCell, Cell, Slice, toNano } from '@ton/core';
import { BatchTransfer, loadTokenTransfer } from '../wrappers/BatchTransfer';
import { NetworkProvider } from '@ton/blueprint';
import { TESTNET_ADDRESS, TOKEN_TRANSFER_OP_CODE } from '../helpers/constant';
import { SampleJetton } from '../wrappers/SampleJetton';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';

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
    console.log('batchTransferJettonWallet', batchTransferJettonWallet.address.toString());

    console.log((await batchTransferJettonWallet.getGetWalletData()).balance);
}
