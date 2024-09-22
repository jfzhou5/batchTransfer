import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/batch-transfer.tact',
    options: {
        debug: true,
    },
};
