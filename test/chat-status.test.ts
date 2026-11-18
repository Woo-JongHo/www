/** @verifies RESP-CHAT-WORKSPACE */
import { expect, test } from 'bun:test';
import { chatStatus, type ChatStatusInput } from '../src/chat-status';
const idle: ChatStatusInput = {sending:false,switching:false,working:false,turn:'idle',turnId:null,transport:'disconnected',interrupt:'idle',approvals:0};
test('고정 상태는 전송·시작·작업·승인·중단·종료·연결 미확인을 구별한다', () => {
  expect(chatStatus(idle).label).toBe('요청 대기');
  expect(chatStatus({...idle,sending:true}).label).toBe('전송 중');
  const running: ChatStatusInput = {...idle,working:true,turn:'running',turnId:'a',transport:'connected'};
  expect(chatStatus({...running,turnId:null}).label).toBe('시작 대기');
  expect(chatStatus(running)).toMatchObject({label:'Working · 작업 중',steer:true});
  expect(chatStatus({...running,approvals:1})).toMatchObject({label:'승인 대기',steer:false});
  expect(chatStatus({...running,interrupt:'requested'})).toMatchObject({label:'중단 확인 중',steer:false});
  expect(chatStatus({...running,transport:'closed'})).toMatchObject({label:'연결 미확인',steer:false});
  expect(chatStatus({...idle,turn:'completed'}).label).toContain('응답 종료');
  expect(chatStatus({...idle,turn:'failed'}).tone).toBe('failed');
  expect(chatStatus({...idle,turn:'unknown'}).label).toContain('미확인');
});
test('Steer 전송 중에도 같은 실행을 Working으로 유지하며 새 대화는 이전 상태를 쓰지 않는다', () => {
  expect(chatStatus({...idle,sending:true,working:true,turn:'running',turnId:'a',transport:'connected'})).toMatchObject({steer:true,label:'Working · 작업 중'});
  expect(chatStatus({...idle,switching:true,working:true,turn:'running',turnId:'a',transport:'connected'})).toMatchObject({steer:false,label:'대화 준비 중'});
  expect(chatStatus(idle).steer).toBe(false);
});
