# 公理设计文档 (ADD): Loop Forge迭代优化

## 1. 引言

本文档基于项目的模块设计文档 (MDD)，运用公理设计（Axiomatic Design）的原则，为 "Loop Forge迭代优化" 提供一个高层次的系统设计描述。公理设计的目标是通过将客户需求 (CNs) 映射到功能需求 (FRs)，再将功能需求映射到设计参数 (DPs)，并力求满足独立性公理和信息公理，从而指导设计过程，创建出鲁棒且高效的系统。

独立性公理强调功能需求之间的独立性，即调整一个设计参数以满足某个功能需求时，不应影响其他功能需求。信息公理则关注设计的简洁性，即在满足功能需求的前提下，设计的信息内容应最小化。

## 2. 客户需求 (Customer Needs - CNs)

从项目目标和用户场景出发，提炼出以下核心客户需求：

*   **CN1**: 用户能够通过AI辅助，迭代地生成、审查和优化文档或代码。
*   **CN2**: 用户能够灵活配置和控制迭代过程的关键参数与流程。
*   **CN3**: 用户能够清晰地追踪和回顾整个迭代历史、AI的输出以及反馈。
*   **CN4**: 系统应能处理用户提供的背景资料，并确保AI的输出具有结构化和可预测性。
*   **CN5**: 系统运行应稳定可靠，并能在出现问题时提供明确的状态和错误反馈。

## 3. 功能需求 (Functional Requirements - FRs)

将客户需求分解为具体的、可操作的功能需求：

*   **FR1: AI驱动的内容生成与修订** (对应CN1, CN4)
    *   FR1.1: 系统必须能接收并处理用户上传的多种格式背景资料文件。
    *   FR1.2: 系统必须能接收用户输入的初始撰写者指令。
    *   FR1.3: AI撰写者必须能根据初始指令和背景资料，生成用户指定数量（N）的独立文档草稿。
    *   FR1.4: AI撰写者必须能根据前一轮审查者选定的草稿和整合反馈，对内容进行修订，并生成N份新的独立文档草稿。
    *   FR1.5: AI撰写者的输出必须采用预定义的、结构化的JSON格式，包含对审查反馈的回应和N份草稿（每份草稿包含内容和修订总结）。

*   **FR2: AI驱动的内容审查与反馈** (对应CN1, CN4)
    *   FR2.1: 系统必须能接收用户输入的审查者审查标准。
    *   FR2.2: AI审查者必须能接收并审查AI撰写者生成的所有N份草稿。
    *   FR2.3: AI审查者必须能为每一份草稿提供独立的、详细的审查意见和0-100分的评分。
    *   FR2.4: AI审查者必须能从N份草稿中选出其认为最优的一份草稿（标记其索引）。
    *   FR2.5: AI审查者必须能提供一份整合的审查反馈，包含选择原因和对下一轮撰写选定草稿的改进建议。
    *   FR2.6: AI审查者的输出必须采用预定义的、结构化的JSON格式，包含对N份草稿的审查数组、选定草稿索引和整合反馈。

*   **FR3: 迭代过程的可配置性与控制** (对应CN2)
    *   FR3.1: 用户必须能配置迭代过程的最小迭代次数。
    *   FR3.2: 用户必须能配置迭代过程的最大迭代次数。
    *   FR3.3: 用户必须能配置迭代停止的目标评分。
    *   FR3.4: 用户必须能配置AI撰写者在每次迭代中生成的草稿数量（例如1-3份）。
    *   FR3.5: 用户必须能启动、重置整个迭代过程；系统能根据配置自动暂停迭代。
    *   FR3.6: 当迭代过程暂停时，用户必须能编辑AI审查者提供的整合反馈，并能手动触发继续执行指定轮次的迭代。

*   **FR4: 迭代历史与结果的可视化与管理** (对应CN3)
    *   FR4.1: 系统必须能按迭代轮次顺序，清晰展示每一轮迭代的完整历史记录。
    *   FR4.2: 每一轮迭代记录必须详细展示该轮的撰写者指令、撰写者输出（包含其对上一轮反馈的回应、N份草稿的修订总结和内容）、审查者输出（包含对N份草稿的独立审查意见和评分、选定的草稿索引、以及整合反馈）。
    *   FR4.3: 系统必须能在界面上高亮或明确标识当前活动的迭代步骤以及被审查者选定的草稿。
    *   FR4.4: 用户必须能下载最终被选定草稿的文档内容。
    *   FR4.5: 系统必须能统计并展示与Gemini API交互所消耗的总输入和输出Token数量。

*   **FR5: 系统稳定性与用户反馈** (对应CN5)
    *   FR5.1: 系统必须能捕获并处理与Gemini API交互时可能发生的错误（例如，无效API密钥、网络问题、配额超限）。
    *   FR5.2: 系统必须能捕获并处理AI响应解析错误（例如，返回的JSON格式不符合预定义的Schema，或关键字段缺失）。
    *   FR5.3: 系统必须能在界面上向用户提供清晰、易懂的当前处理状态信息和错误提示。

## 4. 设计参数 (Design Parameters - DPs)

为每个功能需求（FR）指定具体的设计参数（DP）。DP是实现FR的物理或逻辑手段。

*   **DP1: AI内容生成模块** (实现FR1)
    *   DP1.1: `FileUpload.tsx`组件及其内部的`fileToUploadedFilePart`文件处理逻辑；`App.tsx`中的`backgroundMaterial: UploadedFilePart[]`状态，用于存储和传递处理后的文件信息给API。
    *   DP1.2: `PromptInput.tsx`组件用于接收撰写者指令；`App.tsx`中的`initialWriterPrompt: string`状态。
    *   DP1.3: `geminiService.generateContent`函数，结合`App.tsx`中定义的`writerSchema`（JSON Schema）、撰写者系统提示，以及用户配置的`numberOfDraftsInput`参数，用于生成初稿。
    *   DP1.4: `geminiService.generateContent`函数，结合`App.tsx`中动态构建的、包含先前审查反馈和选定草稿内容的撰写者提示、`writerSchema`，用于修订并生成新草稿。
    *   DP1.5: 在`geminiService.generateContent`调用中，设置`config.responseSchema = writerSchema`和`config.responseMimeType = "application/json"`；`geminiService.parseWriterResponse`函数用于解析和校验AI撰写者的JSON输出。

*   **DP2: AI内容审查模块** (实现FR2)
    *   DP2.1: `PromptInput.tsx`组件用于接收审查者标准；`App.tsx`中的`reviewerCriteria: string`状态。
    *   DP2.2: `geminiService.generateContent`函数，结合`App.tsx`中动态构建的、包含所有待审草稿内容的审查者提示。
    *   DP2.3: `reviewerSchema`中定义的`draftReviews`数组结构，其中每个元素包含`reviewText`和`score`字段。
    *   DP2.4: `reviewerSchema`中定义的`selectedDraftIndex`数字字段。
    *   DP2.5: `reviewerSchema`中定义的`consolidatedFeedbackForNextIteration`字符串字段。
    *   DP2.6: 在`geminiService.generateContent`调用中，设置`config.responseSchema = reviewerSchema`和`config.responseMimeType = "application/json"`；`geminiService.parseReviewerResponse`函数用于解析和校验AI审查者的JSON输出。

*   **DP3: 迭代控制与配置界面模块** (实现FR3)
    *   DP3.1: `App.tsx`中的`minIterationsInput: string`状态及对应的数字输入UI组件。
    *   DP3.2: `App.tsx`中的`maxIterationsInput: string`状态及对应的数字输入UI组件。
    *   DP3.3: `App.tsx`中的`targetScoreInput: string`状态及对应的数字输入UI组件。
    *   DP3.4: `App.tsx`中的`numberOfDraftsInput: string`状态及对应的数字输入UI组件（限制1-3）。
    *   DP3.5: `App.tsx`中的`startIterativeProcess`（启动/重新启动）、`resetState`（重置）函数；`runIterations`函数内部基于配置参数的迭代暂停逻辑；`currentStatus: AppStatus`状态用于控制UI行为。
    *   DP3.6: `App.tsx`中的`isReviewEditable: boolean`状态（控制审查意见编辑区的可用性）、`editableReviewComments: string`状态（存储编辑后的审查意见）、`manualContinueCountInput: string`状态（手动继续轮次）及对应UI；`handleManualContinue`函数用于触发手动继续流程。

*   **DP4: UI展示与交互模块** (实现FR4)
    *   DP4.1: `App.tsx`中的`iterationSteps: IterationStep[]`状态，通过`.map()`方法遍历并渲染`IterationDisplay`组件列表。
    *   DP4.2: `IterationDisplay.tsx`组件，负责结构化展示单个`IterationStep`对象的全部内容，包括其内部的`DraftAndReviewCard`子组件（用于多草稿的选项卡式展示）。
    *   DP4.3: `IterationDisplay.tsx`的`isCurrentActiveStep` prop和`DraftAndReviewCard`的`isSelected` prop，通过CSS类实现视觉高亮。
    *   DP4.4: `App.tsx`中的`downloadFinalDocument`函数，用于生成并下载文本文件。
    *   DP4.5: `App.tsx`中的`totalInputTokensUsed: number`和`totalOutputTokensUsed: number`状态，及其在UI上的展示。

*   **DP5: 错误处理与状态反馈机制** (实现FR5)
    *   DP5.1: `geminiService.generateContent`函数内部的`try...catch`块，对API调用失败（如认证错误、配额问题、网络超时）进行捕获，并向上抛出标准化的错误信息。
    *   DP5.2: `geminiService.parseWriterResponse`和`geminiService.parseReviewerResponse`函数内部的`try...catch`块（处理JSON解析失败）和针对Schema的结构校验逻辑。
    *   DP5.3: `App.tsx`中的`errorMessage: string | null`和`statusMessage: string`状态，用于在UI上向用户显示操作结果、当前进度或错误信息；`currentStatus: AppStatus`状态的切换（例如变为`AppStatus.Error`）。

## 5. FR-DP 映射矩阵 (Design Matrix)

设计矩阵用于分析功能需求（FRs）和设计参数（DPs）之间的关系。理想情况下，矩阵应为对角矩阵（解耦设计）或下三角矩阵（弱耦合设计）。

(注：为简化矩阵，DPs按其主要对应的FR组进行编号，例如DP1.x对应FR1.x。实际影响可能跨越这些主要分组。)

|       | DP1.1 背景资料 | DP1.2 初始撰写指令 | DP1.3 初稿生成逻辑 | DP1.4 修订稿生成逻辑 | DP1.5 撰写输出解析 | DP2.1 审查标准 | DP2.2 审查执行逻辑 | DP2.3 单稿审查结构 | DP2.4 草稿选择结构 | DP2.5 整合反馈结构 | DP2.6 审查输出解析 | DP3.1-3.4 参数配置 | DP3.5 流程控制 | DP3.6 手动继续 | DP4.1-4.3 历史展示 | DP4.4 文档下载 | DP4.5 Token展示 | DP5.1 API错误处理 | DP5.2 解析错误处理 | DP5.3 UI反馈 |
|:------|:-----------:|:-------------:|:-------------:|:---------------:|:-------------:|:-----------:|:---------------:|:---------------:|:---------------:|:---------------:|:-------------:|:-----------------:|:------------:|:------------:|:-----------------:|:------------:|:--------------:|:----------------:|:-----------------:|:----------:|
| **FR1.1** | **X**       |               |               |                 |               |             |                 |                 |                 |                 |               |                   |              |              |                   |              |                |                  |                   |            |
| **FR1.2** |             | **X**         |               |                 |               |             |                 |                 |                 |                 |               |                   |              |              |                   |              |                |                  |                   |            |
| **FR1.3** | x           | x             | **X**         |                 |               |             |                 |                 |                 |                 |               | x (草稿数)        |              |              |                   |              |                | x                | x                 | x          |
| **FR1.4** | x           | x             |               | **X**           |               |             | x (输入草稿)    |                 | x (选定草稿)    | x (反馈)        |               | x (草稿数)        |              | x            |                   |              |                | x                | x                 | x          |
| **FR1.5** |             |               |               |                 | **X**         |             |                 |                 |                 |                 |               |                   |              |              |                   |              |                |                  | x                 |            |
| **FR2.1** |             |               |               |                 |               | **X**       |                 |                 |                 |                 |               |                   |              |              |                   |              |                |                  |                   |            |
| **FR2.2** | x           |               | x (输入草稿)  | x (输入草稿)    |               | x           | **X**           |                 |                 |                 |               | x (草稿数)        |              |              |                   |              |                | x                | x                 | x          |
| **FR2.3** |             |               |               |                 |               |             |                 | **X**           |                 |                 |               |                   |              |              |                   |              |                |                  | x                 |            |
| **FR2.4** |             |               |               |                 |               |             |                 |                 | **X**           |                 |               |                   |              |              |                   |              |                |                  | x                 |            |
| **FR2.5** |             |               |               |                 |               |             |                 |                 |                 | **X**           |               |                   |              |              |                   |              |                |                  | x                 |            |
| **FR2.6** |             |               |               |                 |               |             |                 |                 |                 |                 | **X**         |                   |              |              |                   |              |                |                  | x                 |            |
| **FR3.1-4**|            |               |               |                 |               |             |                 |                 |                 |                 |               | **X**             |              |              |                   |              |                |                  |                   |            |
| **FR3.5** |             |               |               |                 |               |             |                 |                 |                 |                 |               | x                 | **X**        |              |                   |              |                |                  |                   | x          |
| **FR3.6** |             |               |               | x (输入)      |               |             |                 |                 | x (输入)        | x (编辑)        |               | x                 | x            | **X**        |                   |              |                |                  |                   | x          |
| **FR4.1-3**|            |               |               |                 |               |             |                 |                 |                 |                 |               |                   |              |              | **X**             |              |                |                  |                   |            |
| **FR4.4** |             |               |               | x (最终内容)  | x (最终内容)  |             |                 |                 | x (选定索引)    |                 | x (最终内容)  |                   |              |              |                   | **X**        |                |                  |                   |            |
| **FR4.5** |             |               | x             | x               |               |             | x               |                 |                 |                 |               |                   |              |              |                   |              | **X**          |                  |                   |            |
| **FR5.1** |             |               | x             | x               |               |             | x               |                 |                 |                 |               |                   |              |              |                   |              |                | **X**            |                   |            |
| **FR5.2** |             |               |               |                 | x             |             |                 |                 |                 |                 | x             |                   |              |              |                   |              |                |                  | **X**             |            |
| **FR5.3** |             |               |               |                 |               |             |                 |                 |                 |                 |               |                   | x            | x            |                   |              |                | x                | x                 | **X**      |

*   **X**: 主要DP，直接负责实现对应的FR。
*   **x**: 次要影响或依赖。DP的改变可能影响此FR的实现，或FR的实现依赖此DP的输出/状态。

**矩阵分析**:
该设计矩阵呈现出一定的耦合性，尤其是在核心的AI交互功能需求（FR1.3, FR1.4, FR2.2）上，它们依赖于多个输入型DPs（如背景资料、用户指令、前一轮结果）以及错误处理DPs。这是由应用迭代特性的本质决定的——即一个步骤的输出是下一个步骤的输入。
然而，通过模块化的设计（如MDD中所述，将API交互封装在`geminiService`，UI组件分离），这种耦合被控制在可管理的范围内。
*   配置相关的FRs (FR3.1-FR3.4) 与其对应的DPs (DP3.1-3.4) 之间基本是解耦的。
*   UI展示相关的FRs (FR4.x) 自然依赖于提供数据的DPs。
*   错误处理FRs (FR5.x) 与执行API调用和数据解析的DPs相关联，这是符合逻辑的。

关键在于，每个DP的首要职责是满足其对应的主要FR。在调整一个DP以优化其主要FR时，对其他FR的潜在影响应该是可预见和可控的。例如，改变文件上传方式 (DP1.1) 不应直接破坏目标分数的设定逻辑 (DP3.3)。本设计在组件和模块层面努力保持了这种职责分离。

## 6. 结论

本公理设计文档基于MDD，将客户需求转化为明确的功能需求，并为这些功能需求分配了相应的设计参数。通过FR-DP映射矩阵的分析，我们可以看到系统各部分之间的关系。尽管存在一些耦合（特别是围绕核心迭代逻辑），但整体设计通过模块化和清晰的接口定义，力求满足独立性公理，使得系统更易于理解、维护和扩展。

所选择的设计参数旨在直接且有效地满足其对应的功能需求。未来的开发工作应持续关注这些FR-DP关系，确保在实现和修改过程中，对独立性的潜在破坏降到最低，从而保证系统的整体质量和鲁棒性。
