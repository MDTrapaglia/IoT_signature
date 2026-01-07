-- CreateEnum
CREATE TYPE "OracleTransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "OracleTransactionType" AS ENUM ('MINT_NFT', 'CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL,
    "sensor_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "nft_policy_id" TEXT,
    "nft_asset_name" TEXT,
    "script_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "sensor_id" TEXT NOT NULL,
    "temperature" INTEGER,
    "humidity" INTEGER,
    "timestamp" BIGINT,
    "hash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "message" TEXT,
    "verified" BOOLEAN NOT NULL,
    "verification_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oracle_transaction_id" TEXT,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OracleTransaction" (
    "id" TEXT NOT NULL,
    "sensor_id" TEXT NOT NULL,
    "type" "OracleTransactionType" NOT NULL,
    "tx_hash" TEXT,
    "tx_cbor" TEXT,
    "status" "OracleTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "status_message" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "block_height" INTEGER,
    "block_time" TIMESTAMP(3),
    "slot" INTEGER,
    "nft_policy_id" TEXT NOT NULL,
    "nft_asset_name" TEXT NOT NULL,
    "script_address" TEXT,
    "utxo_tx_hash" TEXT,
    "utxo_index" INTEGER,
    "datum_json" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),

    CONSTRAINT "OracleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_sensor_id_key" ON "Sensor"("sensor_id");

-- CreateIndex
CREATE INDEX "Sensor_sensor_id_idx" ON "Sensor"("sensor_id");

-- CreateIndex
CREATE INDEX "Sensor_nft_policy_id_nft_asset_name_idx" ON "Sensor"("nft_policy_id", "nft_asset_name");

-- CreateIndex
CREATE INDEX "Measurement_sensor_id_idx" ON "Measurement"("sensor_id");

-- CreateIndex
CREATE INDEX "Measurement_received_at_idx" ON "Measurement"("received_at");

-- CreateIndex
CREATE INDEX "Measurement_verified_idx" ON "Measurement"("verified");

-- CreateIndex
CREATE INDEX "Measurement_oracle_transaction_id_idx" ON "Measurement"("oracle_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "OracleTransaction_tx_hash_key" ON "OracleTransaction"("tx_hash");

-- CreateIndex
CREATE INDEX "OracleTransaction_sensor_id_idx" ON "OracleTransaction"("sensor_id");

-- CreateIndex
CREATE INDEX "OracleTransaction_status_idx" ON "OracleTransaction"("status");

-- CreateIndex
CREATE INDEX "OracleTransaction_submitted_at_idx" ON "OracleTransaction"("submitted_at");

-- CreateIndex
CREATE INDEX "OracleTransaction_tx_hash_idx" ON "OracleTransaction"("tx_hash");

-- CreateIndex
CREATE INDEX "OracleTransaction_nft_policy_id_nft_asset_name_idx" ON "OracleTransaction"("nft_policy_id", "nft_asset_name");

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "Sensor"("sensor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_oracle_transaction_id_fkey" FOREIGN KEY ("oracle_transaction_id") REFERENCES "OracleTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OracleTransaction" ADD CONSTRAINT "OracleTransaction_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "Sensor"("sensor_id") ON DELETE RESTRICT ON UPDATE CASCADE;
