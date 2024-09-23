import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, Dictionary, fromNano, SendMode, Slice, toNano } from '@ton/core';
import { BatchTransfer } from '../wrappers/BatchTransfer';
import '@ton/test-utils';
import { SampleJetton } from '../wrappers/SampleJetton';
import { buildOnchainMetadata } from '../scripts/utils';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { randomAddress } from '@ton/test-utils';

describe('BatchTransfer', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let batchTransfer: SandboxContract<BatchTransfer>;
    let sampleJetton: SandboxContract<SampleJetton>;
    let deployerSampleJettonWallet: SandboxContract<JettonDefaultWallet>;
    let batchTransferSampleJettonWallet: SandboxContract<JettonDefaultWallet>;
    let user1SampleJettonWallet: SandboxContract<JettonDefaultWallet>;
    let user2SampleJettonWallet: SandboxContract<JettonDefaultWallet>;

    const jettonParams = {
        name: 'SampleJetton',
        description: 'Sample Jetton for testing purposes',
        image: 'https://ipfs.io/ipfs/bafybeicn7i3soqdgr7dwnrwytgq4zxy7a5jpkizrvhm5mv6bgjd32wm3q4/welcome-to-IPFS.jpg',
        symbol: 'SAM',
        decimals: '9',
    };
    const max_supply = (1n << 120n) - 1n;
    const sampleJettonContent = buildOnchainMetadata(jettonParams);

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        batchTransfer = blockchain.openContract(await BatchTransfer.fromInit());

        sampleJetton = blockchain.openContract(
            await SampleJetton.fromInit(deployer.address, sampleJettonContent, max_supply),
        );

        let deployResult = await batchTransfer.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: batchTransfer.address,
            deploy: true,
            success: true,
        });

        deployResult = await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sampleJetton.address,
            deploy: true,
            success: true,
        });

        deployerSampleJettonWallet = blockchain.openContract(
            JettonDefaultWallet.fromAddress(await sampleJetton.getGetWalletAddress(deployer.address)),
        );
        batchTransferSampleJettonWallet = blockchain.openContract(
            JettonDefaultWallet.fromAddress(await sampleJetton.getGetWalletAddress(batchTransfer.address)),
        );
        user1SampleJettonWallet = blockchain.openContract(
            JettonDefaultWallet.fromAddress(await sampleJetton.getGetWalletAddress(user1.address)),
        );
        user2SampleJettonWallet = blockchain.openContract(
            JettonDefaultWallet.fromAddress(await sampleJetton.getGetWalletAddress(user2.address)),
        );

        await sampleJetton.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                amount: toNano(10000),
                receiver: deployer.address,
            },
        );
        expect((await deployerSampleJettonWallet.getGetWalletData()).balance).toBe(toNano(10000));
    });

    it('should deploy', async () => {
        expect(await batchTransfer.getOwner()).toEqualAddress(deployer.address);
    });

    it('set owner rate', async () => {
        expect((await batchTransfer.getConfigs()).ownerRate).toBe(1000n);
        await batchTransfer.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetOwnerRate',
                rate: 2000n,
            },
        );

        expect((await batchTransfer.getConfigs()).ownerRate).toBe(2000n);
    });

    it('Jetton Batch Transfer', async () => {
        const forward_payload: Slice = beginCell()
            .storeUint(0xe5d5a095, 32)
            .storeAddress(batchTransferSampleJettonWallet.address)
            .storeRef(
                beginCell()
                    .storeAddress(user1.address)
                    .storeUint(toNano(50), 120)
                    .storeAddress(user2.address)
                    .storeUint(toNano(50), 120)
                    .endCell(),
            )
            .endCell()
            .asSlice();

        let result = await deployerSampleJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano('0.2'),
            },
            {
                $$type: 'TokenTransfer',
                queryId: 0n, // use queryId as tokenTransfer message id
                amount: toNano(100),
                destination: batchTransfer.address,
                response_destination: deployer.address,
                custom_payload: null,
                forward_ton_amount: toNano('0.15'),
                forward_payload,
            },
        );
        // TokenTransfer
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: deployerSampleJettonWallet.address,
            success: true,
        });
        // TokenTransferInternal
        expect(result.transactions).toHaveTransaction({
            from: deployerSampleJettonWallet.address,
            to: batchTransferSampleJettonWallet.address,
            success: true,
        });
        // TokenNotification
        expect(result.transactions).toHaveTransaction({
            from: batchTransferSampleJettonWallet.address,
            to: batchTransfer.address,
            success: true,
        });
        // TokenTransfer send to user1 / user2
        expect(result.transactions).toHaveTransaction({
            from: batchTransfer.address,
            to: batchTransferSampleJettonWallet.address,
            success: true,
            value: toNano('0.05'),
        });
        // TokenTransferInternal send to user1
        expect(result.transactions).toHaveTransaction({
            from: batchTransferSampleJettonWallet.address,
            to: user1SampleJettonWallet.address,
            success: true,
        });
        // TokenTransferInternal send to user2
        expect(result.transactions).toHaveTransaction({
            from: batchTransferSampleJettonWallet.address,
            to: user2SampleJettonWallet.address,
            success: true,
        });

        printTransactionFees(result.transactions);
        expect((await batchTransferSampleJettonWallet.getGetWalletData()).balance).toEqual(toNano(10));
        expect((await user1SampleJettonWallet.getGetWalletData()).balance).toEqual(toNano(45));
        expect((await user2SampleJettonWallet.getGetWalletData()).balance).toEqual(toNano(45));
        console.log(fromNano((await blockchain.provider(batchTransfer.address).getState()).balance));

        await batchTransfer.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'WithdrawJetton',
                selfJettonWallet: batchTransferSampleJettonWallet.address,
                to: user1.address,
                amount: toNano(10),
            },
        );
        console.log(fromNano((await blockchain.provider(batchTransfer.address).getState()).balance));

        expect((await batchTransferSampleJettonWallet.getGetWalletData()).balance).toEqual(toNano(0));
        expect((await user1SampleJettonWallet.getGetWalletData()).balance).toEqual(toNano(55));
    });

    it('Jetton Batch Transfer max size', async () => {
        for (let index = 0; index < 20; index++) {
            // support max user count:
            const users = new Array(8).fill(0).map((_) => randomAddress());
            const usersSampleJettonWallets = await Promise.all(
                users.map(async (user) => {
                    return blockchain.openContract(
                        JettonDefaultWallet.fromAddress(await sampleJetton.getGetWalletAddress(user)),
                    );
                }),
            );
            const userAmount = toNano(50);
            // require tokenTransfer amount = sum(user amount)
            const amount = userAmount * 8n;

            // build forward_payload
            const forward_payload: Slice = beginCell()
                .storeUint(0xe5d5a095, 32) // opcode of `BatchTransferJetton`
                .storeAddress(batchTransferSampleJettonWallet.address) // jetton wallet of batchTransfer contract
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

            let result = await deployerSampleJettonWallet.send(
                deployer.getSender(),
                {
                    value: totalFee,
                },
                {
                    $$type: 'TokenTransfer',
                    queryId: 0n,
                    amount,
                    destination: batchTransfer.address,
                    response_destination: deployer.address,
                    custom_payload: null,
                    forward_ton_amount,
                    forward_payload,
                },
            );
            // TokenTransfer
            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: deployerSampleJettonWallet.address,
                success: true,
            });
            // TokenTransferInternal
            expect(result.transactions).toHaveTransaction({
                from: deployerSampleJettonWallet.address,
                to: batchTransferSampleJettonWallet.address,
                success: true,
            });
            // TokenNotification
            expect(result.transactions).toHaveTransaction({
                from: batchTransferSampleJettonWallet.address,
                to: batchTransfer.address,
                success: true,
            });
            // TokenTransfer send to user1 / user2
            expect(result.transactions).toHaveTransaction({
                from: batchTransfer.address,
                to: batchTransferSampleJettonWallet.address,
                success: true,
                value: toNano('0.05'),
            });

            usersSampleJettonWallets.forEach(async (wallet) => {
                expect(result.transactions).toHaveTransaction({
                    from: batchTransferSampleJettonWallet.address,
                    to: wallet.address,
                    success: true,
                });
                expect((await wallet.getGetWalletData()).balance).toBe((userAmount * (10000n - 1000n)) / 10000n);
            });
            // printTransactionFees(result.transactions)
            expect((await batchTransferSampleJettonWallet.getGetWalletData()).balance).toEqual(
                toNano(40 * (index + 1)),
            );
            console.log(index, fromNano((await blockchain.provider(batchTransfer.address).getState()).balance));
        }
    });
});
