# Builds tests/fixtures/emsc-ws.json from one real recorded EMSC frame
# (scripts/ws-record.mjs) plus two variants with Portuguese coordinates.
import copy
import json

path = 'tests/fixtures/emsc-ws.json'
real = json.load(open(path))[0]

az = copy.deepcopy(real)
az['action'] = 'create'
az['data']['id'] = '20261028_TEST01'
az['data']['geometry']['coordinates'] = [-26.25, 37.84, -9.0]
az['data']['properties'].update(
    unid='20261028_TEST01', time='2026-10-28T17:40:12.3Z', lat=37.84, lon=-26.25, depth=9.0, mag=3.1,
    magtype='ml', evtype='ke', flynn_region='AZORES ISLANDS, PORTUGAL', auth='PDA', lastupdate='2026-10-28T17:43:00.0Z',
)

qb = copy.deepcopy(az)
qb['data']['properties'].update(unid='20261028_TEST02', evtype='qb', lat=38.7, lon=-9.1, flynn_region='PORTUGAL')

json.dump(
    {
        '_comment': '[0] real EMSC frame recorded 2026-10-28 (Chile, outside the PT bbox); [1] and [2] same shape with Portuguese coordinates (earthquake, quarry blast).',
        'messages': [real, az, qb],
    },
    open(path, 'w'),
    indent=1,
    ensure_ascii=False,
)
