import { Sha256 } from '@aws-crypto/sha256-js';
import { beginCell, Cell, Address } from '@ton/ton';
import { Dictionary, internal, MessageRelaxed, SenderArguments } from '@ton/core';
import * as crc32 from 'crc-32';
import axios from 'axios';
import { sleep } from '@ton/blueprint';

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

function bufferToChunks(buff: Buffer, chunkSize: number) {
    let chunks: Buffer[] = [];
    while (buff.byteLength > 0) {
        chunks.push(buff.slice(0, chunkSize));
        buff = buff.slice(chunkSize);
    }
    return chunks;
}

export function makeSnakeCell(data: Buffer) {
    let chunks = bufferToChunks(data, CELL_MAX_SIZE_BYTES);
    const b = chunks.reduceRight((curCell, chunk, index) => {
        if (index === 0) {
            curCell.storeInt(SNAKE_PREFIX, 8);
        }
        curCell.storeBuffer(chunk);
        if (index > 0) {
            const cell = curCell.endCell();
            return beginCell().storeRef(cell);
        } else {
            return curCell;
        }
    }, beginCell());
    return b.endCell();
}

const sha256 = (str: string) => {
    const sha = new Sha256();
    sha.update(str);
    return Buffer.from(sha.digestSync());
};

export const toKey = (key: string) => {
    return BigInt(`0x${sha256(key).toString('hex')}`);
};

export type JettonMetaData = {
    name: string;
    description: string;
    image: string;
    symbol: string;
    decimals: string;
};

export function buildOnchainMetadata(data: JettonMetaData): Cell {
    let dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    Object.entries(data).forEach(([key, value]) => {
        dict.set(toKey(key), makeSnakeCell(Buffer.from(value, 'utf8')));
    });

    return beginCell().storeInt(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
}

export function calculateRequestOpcode_1(str: string): string {
    return (BigInt(crc32.str(str)) & BigInt(0x7fffffff)).toString(16);
}

function calculateResponseOpcode_2(str: string): string {
    const a = BigInt(crc32.str(str));
    const b = BigInt(0x80000000);
    return ((a | b) < 0 ? (a | b) + BigInt('4294967296') : a | b).toString(16);
}

export const getAddressSeqno = async (address: Address): Promise<number> => {
    const accountId = address.toRawString();
    const testnetTonApiUrl = 'https://testnet.tonapi.io';
    const query = `/v2/wallet/${accountId}/seqno`;
    const testUrl = `${testnetTonApiUrl}${query}`;
    const result = await axios.get(testUrl);
    return result.data?.seqno;
};

export const waitNextSeqno = async (address: Address, beforeSeqno: number) => {
    let currentSeqno = await getAddressSeqno(address);
    let i = 0;
    while (currentSeqno == beforeSeqno && i < 15) {
        await sleep(1000);
        currentSeqno = await getAddressSeqno(address);
    }
    console.log(`Current seqno: ${currentSeqno}`);
    if (currentSeqno !== beforeSeqno + 1) {
        console.log(`Action fail!`);
    } else {
        console.log(`Action success!`);
    }
};

export const senderArgsToMessageRelaxed = (args: SenderArguments): MessageRelaxed => {
    return internal({
        to: args.to,
        value: args.value,
        init: args.init,
        body: args.body,
        bounce: args.bounce,
    });
};

export const cellParse = (src: string): Cell => {
    return Cell.fromBase64(Buffer.from(src, 'hex').toString('base64'));
};
