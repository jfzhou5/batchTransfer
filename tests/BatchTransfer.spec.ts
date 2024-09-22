import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { BatchTransfer } from '../wrappers/BatchTransfer';
import '@ton/test-utils';

describe('BatchTransfer', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let batchTransfer: SandboxContract<BatchTransfer>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        batchTransfer = blockchain.openContract(await BatchTransfer.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await batchTransfer.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: batchTransfer.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and batchTransfer are ready to use
    });
});
