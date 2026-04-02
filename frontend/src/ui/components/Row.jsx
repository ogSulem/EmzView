import React, { useCallback, useEffect, useRef } from 'react';

export const Row = React.memo(function Row({
  title,
  subtitle,
  items,
  renderItem,
  hideIfEmpty = false,
  loading = false,
  onEndReached,
  endReachedOffset = 360,
  loadingMore = false,
  loadingMoreCount = 4,
  error,
  onRetry,
}) {
  const empty = (items?.length ?? 0) === 0;
  if (hideIfEmpty && empty && !loading) return null;

  const rowRef = useRef(null);
  const endSentinelRef = useRef(null);
  const endReachedLockRef = useRef(false);
  const lockTimerRef = useRef(null);
  const lastItemsLenRef = useRef(items?.length ?? 0);
  const loadingMoreRef = useRef(Boolean(loadingMore));

  useEffect(() => {
    loadingMoreRef.current = Boolean(loadingMore);
  }, [loadingMore]);

  useEffect(() => {
    const len = items?.length ?? 0;
    if (len !== lastItemsLenRef.current) {
      lastItemsLenRef.current = len;
      endReachedLockRef.current = false;
    }
  }, [items?.length]);

  useEffect(() => {
    if (!loadingMore) endReachedLockRef.current = false;
  }, [loadingMore]);

  useEffect(() => {
    return () => {
      if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
    };
  }, []);

  function armLockSafetyTimer() {
    if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
    lockTimerRef.current = window.setTimeout(() => {
      endReachedLockRef.current = false;
    }, 10_000);
  }

  const maybeEndReached = useCallback(() => {
    if (!onEndReached) return;
    if (loading || loadingMore) return;
    const el = rowRef.current;
    if (!el) return;

    const remaining = el.scrollWidth - el.scrollLeft - el.clientWidth;
    if (remaining > endReachedOffset) {
      endReachedLockRef.current = false;
      return;
    }

    if (endReachedLockRef.current) return;
    endReachedLockRef.current = true;
    armLockSafetyTimer();
    const ret = onEndReached();
    Promise.resolve(ret)
      .catch(() => null)
      .finally(() => {
        if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
        if (!loadingMoreRef.current) endReachedLockRef.current = false;
      });
  }, [endReachedOffset, loading, loadingMore, onEndReached]);

  useEffect(() => {
    if (!onEndReached) return;
    if (loading || loadingMore) return;

    const root = rowRef.current;
    const target = endSentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries?.[0];
        if (!entry?.isIntersecting) return;
        if (endReachedLockRef.current) return;
        endReachedLockRef.current = true;
        armLockSafetyTimer();
        const ret = onEndReached();
        Promise.resolve(ret)
          .catch(() => null)
          .finally(() => {
            if (lockTimerRef.current) window.clearTimeout(lockTimerRef.current);
            if (!loadingMoreRef.current) endReachedLockRef.current = false;
          });
      },
      {
        root,
        rootMargin: `0px ${endReachedOffset}px 0px ${endReachedOffset}px`,
        threshold: 0.01,
      }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [endReachedOffset, loading, loadingMore, onEndReached, items?.length]);

  return (
    <section className="section">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <div className="sub">{subtitle}</div> : null}
          {error ? (
            <div className="small u-mt8">
              {error}
              {onRetry ? (
                <button className="btn btn-sm u-ml10" type="button" onClick={onRetry}>
                  Повторить
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="row">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="card card-skeleton">
              <div className="card-poster skeleton" />
              <div className="card-title skeleton skeleton-line skeleton-line--mt8" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && empty ? <div className="small">Пока нет</div> : null}
      {!loading && !empty ? (
        <div ref={rowRef} className="row" onScroll={maybeEndReached}>
          {(items ?? []).map((it) => renderItem(it))}
          <div ref={endSentinelRef} style={{ width: 1, height: 1 }} />
          {loadingMore
            ? Array.from({ length: loadingMoreCount }).map((_, idx) => (
                <div key={`more-${idx}`} className="card card-skeleton">
                  <div className="card-poster skeleton" />
                  <div className="card-title skeleton skeleton-line skeleton-line--mt8" />
                </div>
              ))
            : null}
        </div>
      ) : null}
    </section>
  );
});
