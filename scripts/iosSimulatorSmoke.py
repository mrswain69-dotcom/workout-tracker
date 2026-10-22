"""Launch a fresh, signed-out staging app on a hosted iOS Simulator."""
import json,subprocess,time,pathlib

def run(*args):
    return subprocess.check_output(args,text=True,timeout=180)

# Pick the newest available iOS runtime, not watchOS/tvOS or an arbitrary old device.
runtimes=json.loads(run('xcrun','simctl','list','runtimes','--json'))['runtimes']
ios=[r for r in runtimes if r.get('isAvailable') and r['identifier'].startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
if not ios: raise RuntimeError('No available iOS Simulator runtime')
runtime=max(ios,key=lambda r:tuple(map(int,r['version'].split('.'))))
devices=json.loads(run('xcrun','simctl','list','devices','available','--json'))['devices'].get(runtime['identifier'],[])
device=next(d for d in devices if d.get('isAvailable') and d['name'].startswith('iPhone'))
udid=device['udid']
run('xcrun','simctl','bootstatus',udid,'-b')
app='.native-builds/ios/Build/Products/Debug-iphonesimulator/App.app'
run('xcrun','simctl','install',udid,app)
identifier='io.workouttrackerapp.app.staging'
launch=run('xcrun','simctl','launch','--terminate-running-process',udid,identifier)
time.sleep(8)
pathlib.Path('.native-builds/evidence').mkdir(parents=True,exist_ok=True)
run('xcrun','simctl','io',udid,'screenshot','.native-builds/evidence/ios-launch.png')
pathlib.Path('.native-builds/evidence/ios-launch.json').write_text(json.dumps({'device':device['name'],'runtime':runtime['version'],'appId':identifier,'launch':launch.strip(),'scope':'Fresh signed-out launch only; no account journey verified'},indent=2))
run('xcrun','simctl','terminate',udid,identifier)
run('xcrun','simctl','shutdown',udid)
print('Staging app installed, launched and captured on',device['name'],runtime['version'])
