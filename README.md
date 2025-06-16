# “循环锻造”AI撰写工具

一个使用Gemini API进行文档或代码的迭代撰写和审查的Web应用程序。用户可以上传背景资料，AI撰写者生成内容，AI审查者提供反馈和评分，此过程循环进行直到满足条件。

## 功能特性

*   通过 Gemini API 进行 AI 驱动的内容生成和审查。
*   支持迭代式工作流，允许逐步优化内容。
*   用户可以上传背景资料以供 AI 参考。
*   AI 撰写者生成多个草稿供选择。
*   AI 审查者对草稿进行评分和提供反馈。
*   可配置迭代次数、目标分数和每次迭代的草稿数量。
*   支持在迭代过程中手动编辑和调整审查意见。

## 技术栈

*   **前端:** React, TypeScript, Tailwind CSS
*   **AI 服务:** Google Gemini API (`@google/genai`)
*   **构建工具:** Vite
*   **包管理器:** npm

## 项目结构

```
├── .env.local                 # 环境变量 (包含 GEMINI_API_KEY)
├── .gitignore                 # Git 忽略文件配置
├── App.tsx                    # 主要的应用组件
├── README.md                  # 本文档
├── components/                # React 组件目录
│   ├── Button.tsx             # 通用按钮组件
│   ├── FileUpload.tsx         # 文件上传组件
│   ├── IterationDisplay.tsx   # 迭代步骤显示组件
│   ├── LoadingSpinner.tsx     # 加载指示器组件
│   └── PromptInput.tsx        # 提示输入组件
├── constants.ts               # 应用常量定义
├── index.html                 # HTML 入口文件
├── index.tsx                  # React 应用渲染入口
├── metadata.json              # 项目元数据
├── package.json               # 项目依赖和脚本配置
├── services/                  # 服务层 (例如 API 调用)
│   └── geminiService.ts       # Gemini API 服务封装
├── tsconfig.json              # TypeScript 配置文件
├── types.ts                   # TypeScript 类型定义
└── vite.config.ts             # Vite 配置文件
```

## 本地运行

**先决条件:** Node.js

1.  **安装依赖:**
    ```bash
    npm install
    ```
2.  **配置 API 密钥:**
    在项目根目录下创建一个名为 `.env.local` 的文件，并添加您的 Gemini API 密钥：
    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```
    将 `YOUR_API_KEY_HERE` 替换为您的实际 API 密钥。

3.  **运行应用:**
    ```bash
    npm run dev
    ```
    应用通常会在 `http://localhost:5173` (或 Vite 默认的其他端口) 上启动。

## 使用说明

1.  **上传背景资料:** 通过文件上传区域选择并确认上传相关的文本、图片或 PDF 文件作为 AI 的参考资料。
2.  **设置撰写者要求:** 在“初始撰写者要求”文本框中输入您希望 AI 撰写者生成的内容类型和具体要求。
3.  **设置审查者要求:** 在“审查者要求/标准”文本框中输入审查 AI 应关注的方面和评分标准。
4.  **配置迭代参数:**
    *   **最小/最大迭代次数:** 控制迭代过程的轮次范围。
    *   **目标评分:** AI 生成内容达到此评分后，迭代可能会提前结束。
    *   **每次迭代草稿数:** 设置 AI 撰写者在每一轮生成的不同草稿数量 (1-3个)。
5.  **开始迭代:** 点击“开始迭代”按钮。
6.  **监控过程:** 应用将显示每一轮的撰写者输出和审查者反馈。
7.  **手动干预 (如果需要):** 当迭代暂停时 (例如达到目标分数或需要用户输入)，您可以编辑审查者的反馈，然后选择继续迭代。
8.  **查看结果:** 迭代完成后，您可以查看最终选定的内容和整个迭代历史。

## 注意事项

*   确保您的 `GEMINI_API_KEY` 是有效的，并且具有访问所需 Gemini 模型的权限。
*   根据您的使用情况，请注意 Gemini API 的使用限制和配额。
