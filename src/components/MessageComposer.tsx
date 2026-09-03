import type { ChangeEvent, FormEvent } from 'react';
import type { MessageImage } from '../types';

interface MessageComposerProps {
  draft: string;
  images: MessageImage[];
  isImageModel: boolean;
  isSending: boolean;
  onDraftChange: (draft: string) => void;
  onImagesChange: (images: MessageImage[]) => void;
  onStop: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const MAX_IMAGE_COUNT = 4;

function fileToMessageImage(file: File): Promise<MessageImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result),
      });
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

export function MessageComposer({
  draft,
  images,
  isImageModel,
  isSending,
  onDraftChange,
  onImagesChange,
  onStop,
  onSubmit,
}: MessageComposerProps) {
  async function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    const remainingSlots = MAX_IMAGE_COUNT - images.length;
    const selectedImages = await Promise.all(files.slice(0, remainingSlots).map(fileToMessageImage));
    onImagesChange([...images, ...selectedImages]);
  }

  function removeImage(imageId: string) {
    onImagesChange(images.filter((image) => image.id !== imageId));
  }

  return (
    <form className="composer" onSubmit={onSubmit}>
      {images.length > 0 && (
        <div className="image-preview-list">
          {images.map((image) => (
            <figure className="image-preview" key={image.id}>
              <img alt={image.name} src={image.dataUrl} />
              <figcaption>{image.name}</figcaption>
              <button aria-label={`移除 ${image.name}`} onClick={() => removeImage(image.id)} type="button">
                ×
              </button>
            </figure>
          ))}
        </div>
      )}

      <div className="composer-input-row">
        <label className={`ghost-button attach-button ${images.length >= MAX_IMAGE_COUNT || isSending ? 'disabled' : ''}`}>
          {isImageModel ? '参考图' : '图片'}
          <input
            accept="image/*"
            disabled={images.length >= MAX_IMAGE_COUNT || isSending}
            multiple
            onChange={(event) => void handleImageSelect(event)}
            type="file"
          />
        </label>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'c' && isSending) {
              event.preventDefault();
              onStop();
              return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={isImageModel
            ? '描述要生成的图片；上传参考图后可进行编辑，Ctrl/Cmd + Enter 发送'
            : '输入问题，可上传图片后提问，Ctrl/Cmd + Enter 发送'}
          rows={3}
        />
        {isSending ? (
          <button className="ghost-button send-button stop-button" onClick={onStop} type="button">
            停止
          </button>
        ) : (
          <button className="primary-button send-button" disabled={!draft.trim() && images.length === 0} type="submit">
            {isImageModel ? (images.length ? '编辑图片' : '生成图片') : '发送'}
          </button>
        )}
      </div>
    </form>
  );
}
