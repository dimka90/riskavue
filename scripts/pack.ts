import 'dotenv/config';
import {spawnSync} from 'node:child_process';
import './configure-manifest.ts';
const origin=new URL(process.env.APP_ORIGIN||'http://localhost:5173').origin;
const build=spawnSync('npm',['run','build'],{stdio:'inherit',env:{...process.env,VITE_API_ORIGIN:origin}});
if(build.status!==0)process.exit(build.status??1);
const pack=spawnSync('node_modules/.bin/evenhub',['pack','app/app.json','app/dist','-o','riskavue.ehpk','--sdk-ver','0.0.16'],{stdio:'inherit'});
process.exit(pack.status??1);
