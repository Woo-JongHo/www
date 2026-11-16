/**
 * @architecture arch.native.build-info
 * @implements RESP-NATIVE-BUILD-INFO
 */
export interface AppBuildInfo {
  version: string;
  commit: string;
  dirty: boolean;
  sourceDigest: string;
  label: string;
}
declare const __WWW_BUILD_INFO__: AppBuildInfo;
/** 빌드가 main과 renderer에 같은 상수를 주입한다. */
export const appBuildInfo: AppBuildInfo = __WWW_BUILD_INFO__;
