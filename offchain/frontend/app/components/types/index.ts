export interface Measurement {
  id: string;
  sensor_id: string;
  temperature?: number;
  humidity?: number;
  timestamp?: string;
  hash: string;
  signature: string;
  public_key: string;
  message?: string;
  verified: boolean;
  verification_error?: string;
  received_at: string;
  oracle_transaction_id?: string;
  oracle_transaction?: OracleTransaction;
}

export interface Sensor {
  id: string;
  sensor_id: string;
  public_key: string;
  name?: string;
  description?: string;
  nft_policy_id?: string;
  nft_asset_name?: string;
  script_address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    measurements: number;
    oracle_transactions: number;
  };
  latest_measurement?: Measurement;
}

export interface OracleTransaction {
  id: string;
  sensor_id: string;
  type: 'MINT_NFT' | 'CREATE' | 'UPDATE' | 'DELETE';
  tx_hash?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'RETRYING';
  status_message?: string;
  submitted_at: string;
  confirmed_at?: string;
  last_checked_at?: string;
  block_height?: number;
  block_time?: string;
  slot?: number;
  nft_policy_id: string;
  nft_asset_name: string;
  retry_count: number;
  sensor?: Sensor;
}

export interface Statistics {
  measurements: {
    total: number;
    verified: number;
    unverified: number;
  };
  sensors: {
    total: number;
    active: number;
    inactive: number;
  };
  transactions: {
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    retrying: number;
  };
}
