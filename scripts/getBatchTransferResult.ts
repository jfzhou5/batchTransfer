import { Address, address, beginCell, Cell, Slice, toNano } from '@ton/core';
import { BatchTransfer, loadTokenTransfer } from '../wrappers/BatchTransfer';
import { NetworkProvider } from '@ton/blueprint';
import { TESTNET_ADDRESS, TOKEN_TRANSFER_OP_CODE } from '../helpers/constant';
import { SampleJetton } from '../wrappers/SampleJetton';
import { JettonDefaultWallet } from '../build/SampleJetton/tact_JettonDefaultWallet';
import { randomAddress } from '@ton/test-utils';
import { waitForTx } from '../helpers/address';
import axios from 'axios';
import { cellParse } from './utils';

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

    // Get events of batchTransfer contract
    // https://tonapi.io/api-v2#operations-Jettons-getJettonsEvents
    let url = `https://testnet.tonapi.io/v2/accounts/${batchTransfer.address.toRawString()}/events?initiator=false&limit=20`;
    const result = await axios.get(url);
    const events = result.data.events;
    // console.dir(result.data, { depth: null });

    // get the latest TokenTransfer event of batchTransfer contract
    const event = events.find(
        (v: any) =>
            v.actions[0].type === 'JettonTransfer' &&
            v.actions[0].status === 'ok' &&
            v.actions[0].JettonTransfer.recipient.address === batchTransfer.address.toRawString(),
    );
    console.dir(event, { depth: null });

    // get tx of the exact TokenTransfer message
    let tokenTransferTx;
    for (const tx of event.actions[0].base_transactions) {
        // get transaction info
        const receipt = (await axios.get(`https://testnet.tonapi.io/v2/blockchain/transactions/${tx}`)).data;
        // console.log(receipt.in_msg.op_code);
        if (receipt.in_msg.op_code === TOKEN_TRANSFER_OP_CODE) {
            tokenTransferTx = receipt;
            break;
        }
    }
    // console.dir(tokenTransferTx);

    // decode TokenTransfer forward_payload to get users and amounts
    const tokenTransferMsg = loadTokenTransfer(cellParse(tokenTransferTx.in_msg.raw_body).asSlice());
    console.log(tokenTransferMsg.queryId)
    
    const forward_payload = tokenTransferMsg.forward_payload;
    // console.log(forward_payload.loadUint(32).toString(16))
    const users = [];
    const amounts: bigint[] = [];
    if (forward_payload.loadUint(32).toString(16) === 'e5d5a095') {
        const selfJettonWallet = forward_payload.loadAddress();
        while (forward_payload.remainingRefs !== 0) {
            const subPayload = forward_payload.loadRef().asSlice();
            users.push(subPayload.loadAddress());
            amounts.push((subPayload.loadUintBig(120) * 9000n) / 10000n);
            users.push(subPayload.loadAddress());
            amounts.push((subPayload.loadUintBig(120) * 9000n) / 10000n);
        }
    }

    const usersJettonWallets = await Promise.all(users.map(async (user) => await sam.getGetWalletAddress(user)));
    // console.log(users.map((v) => v.toRawString()));
    // console.log(usersJettonWallets.map((v) => v.toRawString()));
    // console.log(amounts);
    // event.actions.forEach((v:any) => {
    //     console.log(
    //         v.type,
    //         v.status,
    //         v.JettonTransfer.sender.address,
    //         v.JettonTransfer.recipients_wallet,
    //         v.JettonTransfer.amount,
    //     );
    // });

    // verify the batch token transfer results from event
    const failedUsers = users
        .map((user, index) => {
            if (
                !event.actions.some(
                    (v: any) =>
                        v.type === 'JettonTransfer' &&
                        v.status === 'ok' &&
                        v.JettonTransfer.sender.address === batchTransfer.address.toRawString() &&
                        v.JettonTransfer.recipients_wallet === usersJettonWallets[index].toRawString() &&
                        v.JettonTransfer.amount === amounts[index].toString(),
                )
            ) {
                return user;
            }
        })
        .filter((v) => v !== undefined);

    console.log(failedUsers);
}
