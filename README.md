# batchTransfer

## Build Blueprint project

<https://github.com/ton-org/blueprint?tab=readme-ov-file#quick-start->

## Start

Tact compiler requires node version >= v22.0.0

```shell
# install dependencies
yarn

# compile contracts
yarn build:all

# run unit test
yarn test

```

## scripts

Firstly `cp .env.sample .env` and add `WALLET_MNEMONIC` into `.env`

Testnet contracts: `helpers/constant.ts`

```shell
# mint some Test Jetton
yarn run:testnet mintJetton

# run batchTransferJetton
yarn run:testnet batchTransferJetton

# get batchTransfer result
yarn run:testnet getBatchTransferResult

# get batchTransfer contract jetton balance
yarn run:testnet getBatchTransferJettonBalance

# Owner: withdraw jetton
yarn run:testnet withdrawJetton
```
