import requests
import csv
import json

WIX_API_URL = 'https://wekwerth.net/_functions/updateTable'
TSV_FILE_PATH = '/home/nik/espn-scraper/leaderboard.tsv'

# Map TSV headers to Wix field IDs (case-insensitive)
FIELD_MAP = {
    'POS': 'pos',
    'PLAYER': 'player',
    'SCORE': 'score',
    'TODAY': 'today',
    'THRU': 'thru',
    'R1': 'r1',
    'R2': 'r2',
    'R3': 'r3',
    'R4': 'r4',
    'TOT': 'tot'
}

WIX_FIELDS = ['pos', 'player', 'score', 'today', 'thru', 'r1', 'r2', 'r3', 'r4', 'tot']


def read_tsv(file_path):
    data_list = []
    with open(file_path, 'r') as tsvfile:
        reader = csv.DictReader(tsvfile, delimiter='\t')
        # Build a map from Wix field to actual TSV column name (case-insensitive)
        tsv_headers = reader.fieldnames
        header_map = {}
        for tsv_col in tsv_headers:
            col_clean = tsv_col.strip().upper()
            wix_field = FIELD_MAP.get(col_clean)
            if wix_field:
                header_map[wix_field] = tsv_col  # Map Wix field to actual TSV column name

        for row in reader:
            mapped_row = {}
            for wix_field in WIX_FIELDS:
                tsv_col = header_map.get(wix_field)
                mapped_row[wix_field] = row.get(tsv_col, '') if tsv_col else ''
            data_list.append(mapped_row)
    return data_list


def upload_data(data):
    headers = {'Content-Type': 'application/json'}
    print("Uploading the following data (first 2 rows):")
    print(json.dumps(data[:2], indent=2))
    response = requests.post(WIX_API_URL, json=data, headers=headers)
    print("Status code:", response.status_code)
    print("Response text:", response.text)


if __name__ == "__main__":
    data = read_tsv(TSV_FILE_PATH)
    upload_data(data)