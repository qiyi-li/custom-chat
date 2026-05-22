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
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>服务商和 API Key 已由 Cloudflare Worker 托管，选择模型即可对话</p>
      </div>
      <div className="model-controls">
        <select value={selectedModel} onChange={(event) => onModelChange(event.target.value)}>
          <option value="">选择模型</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>{model.id}</option>
          ))}
        </select>
        <button className="ghost-button compact" disabled={isLoadingModels} onClick={onRefreshModels}>
          {isLoadingModels ? '加载中' : '刷新模型'}
        </button>
      </div>
    </header>
  );
}
