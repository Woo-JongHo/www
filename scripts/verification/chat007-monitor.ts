import { execFileSync } from "node:child_process";
import { monitorContract } from "./chat007-contract.ts";

// Electron이 정확히 이 명령의 소스를 로드하도록 배포 번들을 먼저 갱신한다.
execFileSync(process.execPath, ["run", "build.ts"], { env: { ...process.env, WWW_CHAT007_OBSERVE_INPUTS: "1" }, stdio: ["ignore", "ignore", "inherit"] });
const observed = execFileSync("node", ["scripts/verify-native-activity.ts", "--chat007-monitor"], { encoding: "utf8", timeout: 120000 });
if (observed.trim() !== JSON.stringify(monitorContract.observations)) throw Error("AC-11 실제 화면 관찰 불일치: " + observed);
process.stdout.write(observed);
