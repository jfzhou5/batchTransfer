import { Address, toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { SampleJetton } from '../build/SampleJetton/tact_SampleJetton';
import { waitForTx } from '../helpers/address';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';

export async function run(provider: NetworkProvider, args: string[]) {
    const userAddress = Address.parse(provider.sender().address?.toString() || '');
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('SampleJetton address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const sampleJetton = provider.open(SampleJetton.fromAddress(address));

    await sampleJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Mint',
            receiver: userAddress,
            amount: toNano('50000'),
        },
    );
    await waitForTx(provider, userAddress);
    console.log(`Minted 50000 token to ${userAddress.toString()}`);

    const userJettonWallet = provider.open(
        JettonDefaultWallet.fromAddress(await sampleJetton.getGetWalletAddress(userAddress)),
    );
    console.log(await userJettonWallet.getGetWalletData());
}
