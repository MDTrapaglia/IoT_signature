#!/usr/bin/env tsx
import { BlockfrostProvider } from '@meshsdk/core';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const provider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || '');
    const oracleAddr = 'addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm';

    console.log('Fetching transaction history for oracle address...\n');
    const txs = await provider.fetchAddressTxs(oracleAddr);
    console.log(JSON.stringify(txs, null, 2));
}

main();
