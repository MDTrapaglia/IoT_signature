#!/usr/bin/env python3
"""
End-to-End Testing Script
=========================

Tests the complete flow:
ESP32 (simulated) → API REST → Backend → Lucid Evolution → Cardano

This script:
1. Loads test payloads with valid Ed25519 signatures
2. Sends measurements to /api/ingest
3. Monitors oracle transaction status
4. Verifies confirmation on Cardano

Usage:
    python scripts/test_e2e.py [--host HOST] [--token TOKEN] [--watch]

Requirements:
    pip install requests python-dotenv
"""

import requests
import json
import time
import sys
import os
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import argparse

# Configuration
DEFAULT_HOST = "http://localhost:3001"
DEFAULT_TOKEN = "c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885"
TEST_DATA_DIR = Path(__file__).parent.parent / "test-data"
EXAMPLES_DIR = Path(__file__).parent.parent / "examples"

class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text: str):
    """Print formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")

def print_success(text: str):
    """Print success message"""
    print(f"{Colors.OKGREEN}✅ {text}{Colors.ENDC}")

def print_error(text: str):
    """Print error message"""
    print(f"{Colors.FAIL}❌ {text}{Colors.ENDC}")

def print_warning(text: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠️  {text}{Colors.ENDC}")

def print_info(text: str):
    """Print info message"""
    print(f"{Colors.OKCYAN}ℹ️  {text}{Colors.ENDC}")

def print_progress(text: str):
    """Print progress message"""
    print(f"{Colors.OKBLUE}🔄 {text}{Colors.ENDC}")

class E2ETest:
    """End-to-End Test Runner"""

    def __init__(self, host: str, token: str):
        self.host = host.rstrip('/')
        self.token = token
        self.session = requests.Session()
        self.measurements_sent = []
        self.transactions = {}

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[requests.Response]:
        """Make HTTP request with error handling"""
        url = f"{self.host}{endpoint}"
        params = kwargs.pop('params', {})
        params['token'] = self.token

        try:
            response = self.session.request(method, url, params=params, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.ConnectionError:
            print_error(f"Cannot connect to {url}")
            print_info("Make sure the backend is running: npm run dev")
            return None
        except requests.exceptions.HTTPError as e:
            print_error(f"HTTP Error {response.status_code}: {response.text}")
            return None
        except Exception as e:
            print_error(f"Request failed: {str(e)}")
            return None

    def check_backend_status(self) -> bool:
        """Check if backend is running"""
        print_progress("Checking backend status...")
        response = self._make_request('GET', '/api/statistics')

        if response:
            stats = response.json()
            print_success(f"Backend is running at {self.host}")
            print_info(f"Total measurements: {stats.get('measurements', {}).get('total', 0)}")
            print_info(f"Total transactions: {stats.get('transactions', {}).get('total', 0)}")
            return True
        return False

    def get_sensors(self) -> List[Dict]:
        """Get list of registered sensors"""
        print_progress("Fetching registered sensors...")
        response = self._make_request('GET', '/api/sensors')

        if response:
            sensors = response.json()
            print_success(f"Found {len(sensors)} registered sensor(s)")

            for sensor in sensors:
                print_info(f"  - {sensor['sensor_id']}")
                if sensor.get('nft_policy_id'):
                    print_info(f"    NFT: {sensor['nft_policy_id'][:16]}...")
                    print_info(f"    Script: {sensor.get('script_address', 'N/A')[:20]}...")
                else:
                    print_warning(f"    No NFT configured - oracle updates will be skipped")

            return sensors
        return []

    def send_measurement(self, payload: Dict) -> Optional[Dict]:
        """Send measurement to /api/ingest"""
        sensor_id = payload['sensor_id']
        print_progress(f"Sending measurement from {sensor_id}...")

        # Format timestamp for display
        timestamp = payload.get('timestamp', 0)
        dt = datetime.fromtimestamp(timestamp / 1000) if timestamp else None

        print_info(f"  Temperature: {payload.get('temperature', 0) / 10}°C")
        print_info(f"  Humidity: {payload.get('humidity', 0) / 10}%")
        print_info(f"  Timestamp: {dt.isoformat() if dt else 'N/A'}")
        print_info(f"  Hash: {payload.get('hash', 'N/A')[:16]}...")
        print_info(f"  Signature: {payload.get('signature', 'N/A')[:16]}...")

        response = self._make_request('POST', '/api/ingest', json=payload)

        if response:
            result = response.json()

            if result.get('verified'):
                print_success(f"Measurement accepted and verified!")
                print_info(f"  Measurement ID: {result.get('measurement_id')}")
                self.measurements_sent.append(result.get('measurement_id'))
                return result
            else:
                print_error(f"Measurement rejected: {result.get('error')}")
                return None

        return None

    def get_transactions(self, sensor_id: Optional[str] = None) -> List[Dict]:
        """Get oracle transactions"""
        print_progress("Fetching oracle transactions...")

        params = {}
        if sensor_id:
            params['sensor_id'] = sensor_id

        response = self._make_request('GET', '/api/transactions', params=params)

        if response:
            transactions = response.json()
            print_success(f"Found {len(transactions)} transaction(s)")

            for tx in transactions:
                status = tx.get('status', 'UNKNOWN')
                tx_hash = tx.get('tx_hash', 'N/A')
                sensor = tx.get('sensor_id', 'N/A')

                # Color code by status
                if status == 'CONFIRMED':
                    print_success(f"  [{status}] {sensor}: {tx_hash[:16]}...")
                elif status == 'PENDING':
                    print_info(f"  [{status}] {sensor}: {tx_hash[:16]}...")
                elif status == 'FAILED':
                    print_error(f"  [{status}] {sensor}: {tx.get('status_message', 'Unknown error')}")
                else:
                    print_warning(f"  [{status}] {sensor}: {tx_hash[:16] if tx_hash != 'N/A' else 'No hash yet'}...")

            return transactions

        return []

    def monitor_transactions(self, timeout: int = 300) -> bool:
        """Monitor transactions until confirmed or timeout"""
        print_header("Monitoring Transaction Confirmations")
        print_info(f"Will check every 15 seconds for up to {timeout} seconds...")

        start_time = time.time()
        check_count = 0

        while time.time() - start_time < timeout:
            check_count += 1
            print_progress(f"\nCheck #{check_count} - {int(time.time() - start_time)}s elapsed")

            transactions = self.get_transactions()

            if not transactions:
                print_warning("No transactions found yet. Waiting for oracle-submission service...")
                time.sleep(15)
                continue

            # Count by status
            pending = sum(1 for tx in transactions if tx.get('status') == 'PENDING')
            confirmed = sum(1 for tx in transactions if tx.get('status') == 'CONFIRMED')
            failed = sum(1 for tx in transactions if tx.get('status') == 'FAILED')

            print_info(f"Status: {confirmed} confirmed, {pending} pending, {failed} failed")

            # Check if all are confirmed or failed
            if pending == 0:
                if confirmed > 0:
                    print_success(f"\n🎉 All transactions confirmed!")

                    # Show Cardano explorer links
                    print_info("\nCardano Explorer Links:")
                    for tx in transactions:
                        if tx.get('status') == 'CONFIRMED' and tx.get('tx_hash'):
                            print_info(f"  https://preprod.cardanoscan.io/transaction/{tx['tx_hash']}")

                    return True
                else:
                    print_error("\n❌ All transactions failed")
                    return False

            # Wait before next check
            print_info("Waiting 15 seconds before next check...")
            time.sleep(15)

        print_warning(f"\n⏱️  Timeout reached after {timeout} seconds")
        print_info("Some transactions may still be pending. Check later with:")
        print_info("  npm run db:status")
        return False

    def run_test(self, test_payloads: List[Dict], watch: bool = False):
        """Run complete E2E test"""
        print_header("ESP32 IoT Oracle - End-to-End Test")

        # Step 1: Check backend
        if not self.check_backend_status():
            print_error("Backend is not accessible. Exiting.")
            sys.exit(1)

        # Step 2: Check sensors
        print_header("Step 1: Verify Sensor Configuration")
        sensors = self.get_sensors()

        if not sensors:
            print_warning("No sensors registered!")
            print_info("Register a sensor with: npm run db:register-sensor")
            sys.exit(1)

        # Check if sensors have NFT configured
        sensors_with_nft = [s for s in sensors if s.get('nft_policy_id')]
        if not sensors_with_nft:
            print_warning("No sensors have NFT configured!")
            print_info("Oracle updates will be skipped.")
            print_info("To enable oracle updates:")
            print_info("  1. Mint NFT: npm run oracle:mint-nft -- <sensor_id>")
            print_info("  2. Create oracle: npm run oracle:create -- <policy_id> <asset_name>")
            print_info("  3. Update sensor: npm run db:register-sensor -- <sensor_id> <public_key> <policy_id> <asset_name> <script_address>")

        # Step 3: Send measurements
        print_header("Step 2: Send Test Measurements")

        for i, payload in enumerate(test_payloads, 1):
            print_info(f"\nSending measurement {i}/{len(test_payloads)}")
            result = self.send_measurement(payload)

            if result:
                # Wait a bit between measurements to avoid overwhelming the service
                if i < len(test_payloads):
                    print_info("Waiting 2 seconds before next measurement...")
                    time.sleep(2)

        if not self.measurements_sent:
            print_error("\nNo measurements were accepted. Test failed.")
            sys.exit(1)

        print_success(f"\n✅ {len(self.measurements_sent)} measurement(s) sent successfully!")

        # Step 4: Check if auto-submission is enabled
        print_header("Step 3: Oracle Auto-Submission")
        print_info("Waiting 10 seconds for oracle-submission service to process...")
        time.sleep(10)

        transactions = self.get_transactions()

        if not transactions:
            print_warning("No oracle transactions found yet.")
            print_info("Possible reasons:")
            print_info("  1. ORACLE_AUTO_SUBMIT is not enabled in .env")
            print_info("  2. Sensors don't have NFT configured")
            print_info("  3. Oracle submission service encountered an error")
            print_info("\nCheck backend logs for details.")

            if not watch:
                sys.exit(0)

        # Step 5: Monitor confirmations (if watch mode)
        if watch and transactions:
            success = self.monitor_transactions(timeout=300)
            sys.exit(0 if success else 1)
        else:
            print_info("\nTo monitor confirmations, run with --watch flag")
            print_info("Or check status manually:")
            print_info("  npm run db:status")
            print_info("  curl 'http://localhost:3001/api/transactions?token=<TOKEN>'")

def load_test_payloads() -> List[Dict]:
    """Load test payloads from test-data directory"""
    payloads = []

    # Try loading test_payload_ed25519_e2e.json
    e2e_path = TEST_DATA_DIR / "test_payload_ed25519_e2e.json"
    if e2e_path.exists():
        with open(e2e_path, 'r') as f:
            payload = json.load(f)
            payloads.append(payload)
            print_info(f"Loaded E2E test payload: {payload['sensor_id']}")

    # Try loading test_oracle_data.json (has multiple payloads)
    oracle_data_path = EXAMPLES_DIR / "test_oracle_data.json"
    if oracle_data_path.exists():
        with open(oracle_data_path, 'r') as f:
            data = json.load(f)
            if isinstance(data, list):
                # Convert uppercase hex to lowercase (API expects lowercase)
                for item in data:
                    item['signature'] = item['signature'].lower()
                    item['publicKey'] = item['public_key'].lower()
                    del item['public_key']  # API expects 'publicKey'
                payloads.extend(data)
                print_info(f"Loaded {len(data)} oracle test payload(s)")

    if not payloads:
        print_error("No test payloads found!")
        print_info("Expected files:")
        print_info(f"  - {e2e_path}")
        print_info(f"  - {oracle_data_path}")
        sys.exit(1)

    return payloads

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="ESP32 IoT Oracle - End-to-End Test")
    parser.add_argument('--host', default=DEFAULT_HOST, help=f"Backend host (default: {DEFAULT_HOST})")
    parser.add_argument('--token', default=DEFAULT_TOKEN, help="API access token")
    parser.add_argument('--watch', action='store_true', help="Monitor transactions until confirmed")
    parser.add_argument('--payload', help="Path to custom payload JSON file")

    args = parser.parse_args()

    # Load test payloads
    if args.payload:
        with open(args.payload, 'r') as f:
            data = json.load(f)
            payloads = [data] if isinstance(data, dict) else data
    else:
        payloads = load_test_payloads()

    # Run test
    tester = E2ETest(args.host, args.token)
    tester.run_test(payloads, watch=args.watch)

if __name__ == "__main__":
    main()
