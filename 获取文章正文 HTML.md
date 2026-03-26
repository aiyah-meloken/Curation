# 获取文章正文 HTML

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /fbmain/monitor/v3/article_html:
    post:
      summary: 获取文章正文 HTML
      deprecated: false
      description: |-
        |                 状态码                 |          说明          |
        |:-----------------------------------:|:--------------------:|
        | {"message":"Internal Server Error"} |     网络错误，请重试1~3次     |
        |                  0                  |          成功          |
        |              101        |     文章被删除或违规或公众号已迁移    |
        |             105,106        |          文章解析失败           |
        |             107        |          解析失败，请重试          |

        qps=5


        ### 返回结果
        | 字段 | 说明 |
        | --- | --- |
        | ['code'] | 状态码 |
        | ['msk'] | 消息 |
        | ['cost_money'] | 扣除金额 |
        | ['remain_money'] | 剩余金额 |
        | ['data'] | 返回数据 |
        | ['data']['title'] | 标题 |
        | ['data']['biz'] | biz |
        | ['data']['article_url'] | 文章链接 |
        | ['data']['mp_head_img'] | 公众号头像链接 |
        | ['data']['cover_url'] | 文章封面链接 |
        | ['data']['nickname'] | 昵称 |
        | ['data']['post_time'] | 发文时间 时间戳 |
        | ['data']['post_time_str'] | 发文时间 字符串格式 |
        | ['data']['gh_id'] | 原始ID |
        | ['data']['wxid'] | 微信ID |
        | ['data']['signature'] | 公众号简介 |
        | ['data']['author'] | 作者 |
        | ['data']['desc'] | 简介|
        | ['data']['copyright'] | 是否原创 |
        | ['data']['html'] | 文章正文 |
        | ['data']['ip_wording'] | ip属地 |
      tags:
        - 公众号文章内容和互动数据等
        - 文章
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                url:
                  type: string
                  description: 微信文章链接 （0.04/次）
                key:
                  type: string
                  description: 极致了官网 key
                verifycode:
                  type: string
                  description: 附加码，如设置了附加码verifycode，则此参数为必选，如未设置则为非必选
              x-apifox-orders:
                - url
                - key
                - verifycode
              required:
                - url
                - key
                - verifycode
            example:
              url: >-
                https://mp.weixin.qq.com/s?__biz=MjM5MjAxNDM4MA==&mid=2666900240&idx=1&sn=a130a51c16cbe0169dd776a470e63bba&chksm=bc1219084e2f51c60f29a7a5d8c25e6ed32554270bf36dbb032fdc6d39d05d2c24742d3367d2#rd
              key: '{{key}}'
              verifycode: ''
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                    description: 状态码
                  msk:
                    type: string
                    description: 消息
                  cost_money:
                    type: number
                    description: 扣除金额
                  remain_money:
                    type: number
                    description: 剩余金额
                  data:
                    type: object
                    properties:
                      title:
                        type: string
                        description: 标题
                      biz:
                        type: string
                        description: biz
                      article_url:
                        type: string
                        description: 文章链接
                      mp_head_img:
                        type: string
                        description: 公众号头像链接
                      cover_url:
                        type: string
                        description: 文章封面链接
                      nickname:
                        type: string
                        description: 昵称
                      post_time:
                        type: integer
                        description: 发文时间 时间戳
                      post_time_str:
                        type: string
                        description: 发文时间 字符串格式
                      gh_id:
                        type: string
                        description: 原始ID
                      wxid:
                        type: string
                        description: 微信ID
                      source_url:
                        type: string
                      signature:
                        type: string
                        description: 公众号简介
                      author:
                        type: string
                        description: 作者
                      desc:
                        type: string
                        description: 简介
                      copyright:
                        type: integer
                        description: 是否原创
                      html:
                        type: string
                        description: 文章正文
                      ip_wording:
                        type: string
                        description: ip属地
                    required:
                      - title
                      - biz
                      - article_url
                      - mp_head_img
                      - cover_url
                      - nickname
                      - post_time
                      - post_time_str
                      - gh_id
                      - wxid
                      - source_url
                      - signature
                      - author
                      - desc
                      - copyright
                      - html
                      - ip_wording
                    x-apifox-orders:
                      - title
                      - ip_wording
                      - biz
                      - article_url
                      - mp_head_img
                      - cover_url
                      - nickname
                      - post_time
                      - post_time_str
                      - gh_id
                      - wxid
                      - source_url
                      - signature
                      - author
                      - desc
                      - copyright
                      - html
                    description: 返回数据
                required:
                  - code
                  - msk
                  - cost_money
                  - remain_money
                  - data
                x-apifox-orders:
                  - code
                  - msk
                  - cost_money
                  - remain_money
                  - data
          headers: {}
          x-apifox-name: 成功
        x-200:文章被删除:
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                  msg:
                    type: string
                  content_text:
                    type: string
                  cost_money:
                    type: number
                  remain_money:
                    type: number
                required:
                  - code
                  - msg
                  - content_text
                  - cost_money
                  - remain_money
                x-apifox-orders:
                  - code
                  - msg
                  - content_text
                  - cost_money
                  - remain_money
          headers: {}
          x-apifox-name: 文章被删除
        x-200:公众号封号:
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  code:
                    type: integer
                  msg:
                    type: string
                  content_text:
                    type: string
                  cost_money:
                    type: number
                  remain_money:
                    type: number
                required:
                  - code
                  - msg
                  - content_text
                  - cost_money
                  - remain_money
                x-apifox-orders:
                  - code
                  - msg
                  - content_text
                  - cost_money
                  - remain_money
          headers: {}
          x-apifox-name: 公众号封号
      security: []
      x-apifox-folder: 公众号文章内容和互动数据等
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/4919579/apis/api-199736592-run
components:
  schemas: {}
  securitySchemes: {}
servers:
  - url: https://www.dajiala.com
    description: 正式环境
security: []

```