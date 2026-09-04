/**
 * 常用输入校验正则
 * 说明：MVP 历史数据存在 uuid 与 prefix-id 并存场景，因此采用兼容型模式。
 */
export const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{2,100}$/;

export const GENERIC_ID_PATTERN = /^[a-zA-Z0-9:_-]{2,100}$/;

export const TEAM_ID_PATTERN = /^(team-[a-z0-9]{6,}|[0-9a-fA-F-]{8,})$/;

export const NODE_ID_PATTERN = /^[a-zA-Z0-9:_-]{2,80}$/;
