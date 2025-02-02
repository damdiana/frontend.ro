import React, { useState, useEffect, useRef } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import debounce from 'lodash/debounce';
import { DebouncedFunc } from 'lodash';

import noop from 'lodash/noop';
import { useRouter } from 'next/router';
import Link from '~/components/generic/Link';
import Header from '~/components/Header';
import Footer from '~/components/Footer';
import Markdown from '~/components/Markdown';
import { RootState } from '~/redux/root.reducer';
import { withAuthModal } from '~/services/Hooks';
import PageContainer from '~/components/PageContainer';
import StatusBanner from './StatusBanner/StatusBanner';
import SubmissionService from '~/services/api/Submission.service';
import { UserState, LessonExercise } from '~/redux/user/types';
import {
  SubmissionStatus, SubmissionVersionI, WIPSanitiedSubmission, FeedbackI,
} from '~/../shared/types/submission.types';
import LessonExerciseService from '~/services/api/LessonExercise.service';
import SweetAlertService from '~/services/sweet-alert/SweetAlert.service';
import PageWithAsideMenu from '~/components/layout/PageWithAsideMenu/PageWithAsideMenu';
import HowToResolveFeedbackBanner from './HowToResolveFeedbackBanner/HowToResolveFeedbackBanner';

import styles from './SolveExercise.module.scss';
import { getLessonById } from '~/curriculum/Curriculum';
import Button from '../Button';
import SolveExerciseSkeleton from './SolveExercise.skeleton';
import FolderStructure from '~/../shared/utils/FolderStructure';
import AsideNav from './AsideNav/AsideNav';

import IDE from '../Editor/IDE/IDE';
import { HTML_TUTORIAL_ID, HTML_TUTORIAL_NAME } from '~/services/Constants';
import SubmissionPreview from '../SubmissionPreview/SubmissionPreview';
import RoutingUtils from '~/services/utils/Routing.utils';
import { APIErrorReasons } from '~/../shared/SharedConstants';
import TutorialDescription from '~/tutorials/TutorialDescription/TutorialDescription';
import { startedTutorial } from '~/redux/user/user.actions';
import InitForm from '../Editor/InitForm/InitForm';

interface Props {
  exerciseId: string;
}

interface Submission {
  _id?: string;
  user: UserState['info'];
  exercise: LessonExercise;
  code: string;
  assignee: UserState['info'];
  status: SubmissionStatus;
  feedbacks: FeedbackI[]
}

enum AutoSave {
  NONE,
  IN_PROGRESS,
  DONE,
}

// TODO: refactor to get rid of duplicate code
// https://github.com/FrontEnd-ro/frontend.ro/issues/411
function SolveExercise({
  exerciseId,
  isLoggedIn,
  tutorials,
  dispatch,
}: ConnectedProps<typeof connector> & Props) {
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission>(null);
  const [versions, setVersions] = useState<SubmissionVersionI[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaved, setAutoSaved] = useState<AutoSave>(AutoSave.NONE);
  const [submissionList, setSubmissionList] = useState<
    Pick<WIPSanitiedSubmission, '_id' | 'status' | 'exercise' | 'feedbacks'>[]
  >([]);

  const activeVersionIndex = versions.findIndex((v) => v._id === RoutingUtils.getQueryString(router, 'version'));

  const readonly = submission && (
    submission.status === SubmissionStatus.DONE
    || submission.status === SubmissionStatus.AWAITING_REVIEW
  );

  const submissionIndex = submissionList.findIndex((sub) => {
    return sub.exercise._id === submission?.exercise?._id;
  });

  let [folderStructure, setFolderStructure] = useState<FolderStructure | null>(null);
  useEffect(() => {
    if (submission !== null) {
      setFolderStructure(new FolderStructure({
        ...JSON.parse(submission.code || submission.exercise.example),
        key: submission.exercise._id,
      }));
    }
  }, [submission?.exercise?._id, submission?.code, submission?.exercise?.example]);

  const autoSaveSolution = async (code: string, exerciseId: string, submissionId?: string) => {
    // NOTE: submissionId is optional because we might want to create a new submission
    // instead of updating an existing one
    // Eg: you just start a new exercise and the AutoSave functionality kicks,
    // thus you have no previous submission.
    setAutoSaved(AutoSave.IN_PROGRESS);

    let updatedSubmission;

    try {
      if (submissionId) {
        updatedSubmission = await SubmissionService.updateSubmission(submissionId, {
          status: SubmissionStatus.IN_PROGRESS,
          code,
        });
      } else {
        updatedSubmission = await SubmissionService.createSubmission(
          exerciseId,
          code,
          SubmissionStatus.IN_PROGRESS,
        );
      }

      setSubmission(updatedSubmission);
      setAutoSaved(AutoSave.DONE);
    } catch (err) {
      setAutoSaved(AutoSave.NONE);
      console.error('[autoSaveSolution] failed with', err);
    }
  };

  const debouncedAutoSaveRef = useRef<DebouncedFunc<(code: string)
    => Promise<void>>>(debounce(noop));

  /**
   * Do not save solution if the user is not loggedIn OR
   * if this tutorial hasn't been started OR
   * if we still have feedbacks to be resolved.
   * NOTE: we want to prevent saving if you have feedbacks,
   * because you might edit the code and thus the feedbacks
   * position will get messed up.
   */
  const shouldAutoSaveSolution = isLoggedIn
    && tutorials.includes(submission?.exercise?.type) && submission?.feedbacks?.length === 0;
  useEffect(() => {
    if (!isSubmitting && submission !== null) {
      debouncedAutoSaveRef.current = debounce((code: string) => {
        if (!code || !shouldAutoSaveSolution) {
          return;
        }

        autoSaveSolution(code, exerciseId, submission?._id);
      }, 2000);
    }
    return () => {
      // We want to cancel the previous debounced auto save function,
      // otherwise we'll have a memory leak inside our application.
      debouncedAutoSaveRef.current.cancel();
    };
  }, [submission?.exercise?._id, isSubmitting, shouldAutoSaveSolution]);

  const submitSolution = async () => {
    const code = folderStructure.toJSON();

    if (!validateSubmissionCanBeSent(code, submission)) {
      return;
    }

    setIsSubmitting(true);

    try {
      let updatedSubmission;
      if (submission._id) {
        updatedSubmission = await SubmissionService.updateSubmission(submission._id, {
          status: SubmissionStatus.AWAITING_REVIEW,
          code,
        });
      } else {
        updatedSubmission = await SubmissionService.createSubmission(exerciseId, code);
      }

      setSubmission(updatedSubmission);

      SweetAlertService.toast({
        type: 'success',
        text: 'Ai trimis soluția cu succes',
      });
    } catch (e) {
      if (e.reason === APIErrorReasons.EXERCISE_SUBMISSION_WITHOUT_TUTORIAL_START) {
        await SweetAlertService.content(TutorialDescription, '', {
          isLoggedIn: true,
          tutorialId: HTML_TUTORIAL_ID,
          tutorialName: HTML_TUTORIAL_NAME,
          onSuccess: (tutorialId: string) => {
            dispatch(startedTutorial(tutorialId));
            submitSolution();
          },
          className: 'text-left',
        });
        return;
      }

      console.error('submitSolution: ', e);
      SweetAlertService.toast({
        type: 'error',
        text: e.message ?? 'Nu am putut trimite soluția ta. Mai încearcă.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateSubmissionCanBeSent = (code: string, submission: Submission) => {
    if (!code || FolderStructure.isEmpty(JSON.parse(code))) {
      SweetAlertService.toast({
        timer: 5000,
        type: 'error',
        text: 'Hmm, dacă nu introduci o soluție pe ce să-ți dăm feedback?',
      });
      return false;
    }

    if (submission.feedbacks.length > 0) {
      SweetAlertService.toast({
        timer: 5000,
        type: 'error',
        text: 'Mai sunt câteva feedback-uri nerezolvate.',
      });
      return false;
    }

    if (code === submission.exercise.example) {
      SweetAlertService.toast({
        timer: 5000,
        type: 'error',
        text: 'Se pare că nu ai modificat soluția...',
      });
      return false;
    }

    return true;
  };

  const exitReadonly = () => {
    return SubmissionService.updateSubmission(submission._id, {
      status: SubmissionStatus.IN_PROGRESS,
    })
      .then(setSubmission)
      .catch((err) => {
        console.error('[exitReadonly]', err);
        SweetAlertService.toast({
          type: 'error',
          text: 'Oops! Nu am putut să edităm acest exercițiu. Încearcă din nou!',
        });
      });
  };

  // This fetch happens if you're not logged in
  const fetchExercise = () => {
    return LessonExerciseService
      .getLessonExercise(exerciseId)
      .then((exercise) => {
        setSubmission({
          user: null,
          exercise,
          code: null,
          feedbacks: [],
          assignee: null,
          status: SubmissionStatus.IN_PROGRESS,
        });
        setVersions([]);
      })
      .catch((err) => {
        console.error('[fetchExercise]', err);
        setFetchError(true);
      });
  };

  // This fetch happens if you're logged in
  const fetchSubmission = () => {
    return SubmissionService
      .getOwnSubmission(exerciseId)
      .then((submission) => {
        setSubmission(submission);
      })
      .catch((err) => {
        if (err.code === 404) {
          fetchExercise();
          return;
        }
        console.error('[fetchSubmission]', err);
        setFetchError(true);
      });
  };

  const fetchSubmissionsFromLesson = (lessonId) => {
    return Promise.all([
      isLoggedIn
        ? SubmissionService.getAllSubmissionsFromLesson(lessonId)
        : Promise.resolve([]),
      LessonExerciseService.getAllExercisesForLessons(lessonId),
    ])
      .then(([submissions, lessonExercises]) => {
        if (submissions.length === 0) {
          // One situation in which submissions may be empty
          // is if you're not logged in.
          setSubmissionList(lessonExercises.map((lessonExercise) => ({
            feedbacks: [],
            _id: lessonExercise._id,
            exercise: lessonExercise,
            status: SubmissionStatus.IN_PROGRESS,
          })));
          return;
        }

        setSubmissionList(submissions.map((sub, index) => {
          if (sub === null) {
            return {
              feedbacks: [],
              _id: lessonExercises[index]._id,
              exercise: lessonExercises[index],
              status: SubmissionStatus.IN_PROGRESS,
            };
          }
          return sub;
        }));
      })
      .catch((err) => {
        setSubmissionList([]);
        // Do nothing since the default value is empty Array
        // so the UI is non-breaking
        console.error('[SolveExercise.fetchSubmissionsFromLesson]', err);
      });
  };

  const fetchSubmissionVersions = (submissionId) => {
    return SubmissionService
      .getSubmissionVersions(submissionId)
      .then((versions) => setVersions(versions))
      .catch((err) => {
        setVersions([]);
        console.error('[SolveExercise.fetchSubmissionVersions] Failed to fetch versions', err);
      });
  };

  const onFolderStructureChange = (newFolderStructure: FolderStructure) => {
    if (newFolderStructure.toJSON() !== folderStructure.toJSON()) {
      setFolderStructure(FolderStructure.clone(newFolderStructure));
      setAutoSaved(AutoSave.NONE);
      debouncedAutoSaveRef.current(newFolderStructure.toJSON());
    }
  };

  const onFeedbackDone = async (_id: string) => {
    const previousSubmission = { ...submission };
    const newFeedbacks = submission.feedbacks.filter((f) => f._id !== _id);

    setSubmission({
      ...submission,
      feedbacks: newFeedbacks,
    });

    SubmissionService.markFeedbackAsDone(_id)
      .catch((err) => {
        setSubmission(previousSubmission);
        SweetAlertService.toast({
          type: 'error',
          text: err.reason,
        });
      });
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchSubmission();
    } else {
      fetchExercise();
    }
  }, [exerciseId]);

  useEffect(() => {
    if (isLoggedIn && submission?._id) {
      fetchSubmissionVersions(submission._id);
    }
  }, [isLoggedIn, submission?._id]);

  useEffect(() => {
    if (submission?.exercise?.lesson) {
      fetchSubmissionsFromLesson(submission.exercise.lesson);
    }
  }, [submission?.exercise?.lesson]);

  if (fetchError) {
    return (<ExerciseNotFound />);
  }
  if (!submission || !folderStructure) {
    return (
      <SolveExerciseSkeleton />
    );
  }

  return (
    <PageWithAsideMenu menu={{
      title: getLessonById(submission.exercise.lesson).title,
      Component: (
        <AsideNav
          versions={versions}
          submissions={submissionList}
          currentExerciseId={submission.exercise._id}
          // FIXME: the tutorial ID should be dynamic
          lessonHref={`/${HTML_TUTORIAL_ID}/tutorial/${getLessonById(submission.exercise.lesson).id}`}
        />
      ),
    }}
    >
      {readonly && (
        <StatusBanner
          status={submission.status}
          onExitReadonly={exitReadonly}
        />
      )}
      {!readonly && submission.feedbacks.length > 0 && (
        <HowToResolveFeedbackBanner />
      )}
      <PageContainer className="relative">
        <h1 className="mb-0">
          Exercițiu
          {' '}
          {submission.exercise.type.toUpperCase()}
        </h1>
        <p className="m-0">
          Creat de
          {' '}
          <Link href={`/${submission.exercise.user.username}`}>
            {submission.exercise.user.name || submission.exercise.user.username}
          </Link>

        </p>
        <Markdown markdownString={submission.exercise.body} className={styles.bodyMarkdown} />
        <section>
          <h2> Rezolvă exercițiul </h2>
          {(folderStructure.files.length === 0 && folderStructure.folders.length === 0) ? (
            <InitForm
              createFirstFile={({ name }: { name: string }) => {
                const newFolderStructure = FolderStructure.clone(folderStructure);
                newFolderStructure.addFile(undefined, { name });
                setFolderStructure(newFolderStructure);
              }}
              onFolderStructureUpload={(newFolderStructure) => {
                setFolderStructure(newFolderStructure);
              }}
            />
          ) : (
            <IDE
              feedbacks={submission.feedbacks}
              onFeedbackDone={onFeedbackDone}
              initialFolderStructure={folderStructure}
              readOnlyTooltipMessage="Ai trimis exercițiul către evaluare, deci nu-l poți edita până nu primești feedback."
              onFolderStructureChange={readonly ? undefined : onFolderStructureChange}
            />
          )}
        </section>
        <section className="my-5 d-flex align-items-center justify-content-between">
          <p className="text-silver m-0">
            {autoSaved === AutoSave.IN_PROGRESS && ('Auto saving...')}
            {autoSaved === AutoSave.DONE && ('✔ Progres salvat cu succes!')}
          </p>
          <div>
            <Button
              disabled={readonly}
              loading={isSubmitting}
              variant="success"
              onClick={withAuthModal(isLoggedIn, submitSolution)}
            >
              {isLoggedIn ? 'Trimite' : 'Autentifică-te și trimite soluția'}
            </Button>
            {
              (submission.status !== SubmissionStatus.IN_PROGRESS)
              && (submissionIndex + 1 < submissionList.length) && (
                <Link
                  color="black"
                  variant="contained"
                  prefetch={false}
                  className="d-inline-block ml-2"
                  href={`/rezolva/${submissionList[submissionIndex + 1].exercise._id}`}
                >
                  Rezolvă următorul exercițiu!
                </Link>
              )
            }
          </div>

        </section>
      </PageContainer>
      {activeVersionIndex !== -1 && (
        <SubmissionPreview
          onClose={() => RoutingUtils.removeQuery(router, 'version')}
          className={styles.SubmissionPreview}
          submission={versions[activeVersionIndex]}
          previousSubmissionCode={
            versions[activeVersionIndex + 1]?.code ?? submission.exercise.example
          }
        />
      )}
    </PageWithAsideMenu>
  );
}

const ExerciseNotFound = () => (
  <>
    <Header withNavMenu />
    <PageContainer className="text-center">
      <h1> Oops 😟</h1>
      <h2> Exercițiul e privat sau nu există </h2>

      <Link prefetch={false} variant="contained" color="blue" href="/">
        Navighează acasă
      </Link>
    </PageContainer>
    <Footer />
  </>
);

function mapStateToProps(state: RootState) {
  return {
    isLoggedIn: !!state.user.info,
    tutorials: state.user?.info?.tutorials ?? [],
  };
}

const connector = connect(mapStateToProps);

export default connector(SolveExercise);
