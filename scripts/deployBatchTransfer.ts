import { toNano } from '@ton/core';
import { BatchTransfer } from '../wrappers/BatchTransfer';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const batchTransfer = provider.open(await BatchTransfer.fromInit());

    await batchTransfer.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(batchTransfer.address);

    // run methods on `batchTransfer`
}
