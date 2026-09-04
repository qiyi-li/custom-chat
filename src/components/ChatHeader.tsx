import type { ModelInfo } from '../types';

interface ChatHeaderProps {
  title: string;
  models: ModelInfo[];
  selectedModel: string;
  isLoadingModels: boolean;
  onModelChange: (model: string) => void;
  onRefreshModels: () => void;
}

export function ChatHeader({
  title,
  models,
  selectedModel,
  isLoadingModels,
  onModelChange,
  onRefreshModels,
}: ChatHeaderProps) {
  const isImageModel = selectedModel.startsWith('gpt-image-');

  return (
    <header className="topbar">
      <div>
        <div className="title-line">
          <h1>{title}</h1>
          {selectedModel && <span className={`mode-pill ${isImageModel ? 'image' : 'text'}`}>{isImageModel ? '图片工作流' : '文字对话'}</span>}
        </div>
        <p>{isImageModel ? '输入描述生成图片，或上传参考图进行编辑' : '选择模型后输入消息，支持 Markdown 和图片理解'}</p>
      </div>
      <div className="model-controls">
        <label className="model-select-label">
          <span>模型</span>
          <select aria-label="选择模型" value={selectedModel} onChange={(event) => onModelChange(event.target.value)}>
          <option value="">选择模型</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>{model.id}</option>
          ))}
          </select>
        </label>
        <button aria-label="刷新模型列表" className="ghost-button compact refresh-button" disabled={isLoadingModels} onClick={onRefreshModels}>
          <span aria-hidden="true">↻</span>{isLoadingModels ? '加载中' : '刷新'}
        </button>
      </div>
    </header>
  );
}
